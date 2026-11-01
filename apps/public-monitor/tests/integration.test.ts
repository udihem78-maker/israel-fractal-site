import assert from "node:assert/strict";
import { test } from "node:test";
import { once } from "node:events";
import { spawnSync } from "node:child_process";
import app from "../server/src/app";
import { pool } from "../lib/db/src/index";
import { loadPinnedSnapshot } from "../server/src/lib/public-snapshot";
import { runCollectionIfDue, startMonitorSync, stopMonitorSync } from "../server/src/lib/monitor-sync";

test("PostgreSQL persistence, read-only API, collection locking and failure recovery", async (t) => {
  const { rows: [database] } = await pool.query("SELECT current_database() AS name");
  assert.ok(
    process.env.MONITOR_TEST_DATABASE === "true" && database.name.endsWith("_test"),
    "Integration tests require MONITOR_TEST_DATABASE=true and a dedicated database ending in _test",
  );
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const url = `http://127.0.0.1:${address.port}/api`;
  const pinned = await loadPinnedSnapshot();
  t.after(async () => {
    stopMonitorSync();
    server.close();
    await pool.end();
  });

  await t.test("versioned migrations are repeatable without replacing data", async () => {
    for (let i = 0; i < 2; i++) {
      const result = spawnSync("pnpm", ["db:migrate"], { env: process.env, encoding: "utf8" });
      assert.equal(result.status, 0, "migration should succeed on an already migrated database");
    }
    const { rows } = await pool.query("SELECT name FROM monitor_migrations");
    assert.equal(rows.length, 1);
  });

  await t.test("migration CLI fails with the original checksum diagnostic and rolls back", async () => {
    const { rows: [migration] } = await pool.query("SELECT name, sha256 FROM monitor_migrations LIMIT 1");
    try {
      await pool.query("UPDATE monitor_migrations SET sha256=$1 WHERE name=$2", ["0".repeat(64), migration.name]);
      const result = spawnSync("pnpm", ["db:migrate"], { env: process.env, encoding: "utf8" });
      assert.equal(result.status, 1);
      assert.match(result.stderr, /Database migration failed/);
      assert.match(result.stderr, /Applied migration was changed/);
      const { rows } = await pool.query("SELECT name FROM monitor_migrations");
      assert.equal(rows.length, 1);
    } finally {
      await pool.query("UPDATE monitor_migrations SET sha256=$1 WHERE name=$2", [migration.sha256, migration.name]);
    }
  });

  await t.test("empty storage serves the real hash-checked fallback; startup is opt-in", async (ctx) => {
    await pool.query("UPDATE monitor_sync SET snapshot=NULL, last_attempt=NULL, last_success=NULL, next_attempt=NULL, last_error=NULL, running=false WHERE id=1");
    let upstreamRequests = 0;
    const originalFetch = globalThis.fetch;
    const mockFetch = ctx.mock.method(globalThis, "fetch", async (input: RequestInfo | URL, options?: RequestInit) => {
      if (String(input).startsWith(url)) return originalFetch(input, options);
      upstreamRequests++;
      throw new Error("Unexpected upstream traffic");
    });
    process.env.MONITOR_SYNC_ENABLED = "false";
    startMonitorSync();
    const response = await fetch(`${url}/public-monitor/snapshot`);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "no-store");
    const data = await response.json();
    assert.equal(data.people.length, pinned.people.length);
    assert.equal(data.dataset_origin, "pinned_repository");
    assert.equal(data.sync_active, false);
    assert.equal(upstreamRequests, 0);
    mockFetch.mock.restore();
  });

  await t.test("stored data survives a new reader; reloads never trigger collection", async () => {
    await pool.query("UPDATE monitor_sync SET snapshot=$1::jsonb, last_success=now(), next_attempt=now()+interval '1 day' WHERE id=1", [JSON.stringify(pinned)]);
    for (let i = 0; i < 2; i++) {
      const response = await fetch(`${url}/public-monitor/snapshot`);
      assert.equal(response.status, 200);
      assert.deepEqual((await response.json()).people, pinned.people);
    }
    const status = await (await fetch(`${url}/public-monitor/sync-status`)).json();
    assert.ok(status.last_success);
    assert.equal(status.freshness.sources.find((s: { key: string }) => s.key === "attendance").activity.status, "stale");
    assert.equal((await fetch(`${url}/readyz`)).status, 200);
    assert.equal((await fetch(`${url}/public-monitor/snapshot`, { method: "POST" })).status, 404);
    assert.equal((await fetch(`${url}/not-a-route`)).status, 404);
  });

  await t.test("due time and a competing PostgreSQL lock prevent duplicate collection", async (ctx) => {
    const mockFetch = ctx.mock.method(globalThis, "fetch", async () => { throw new Error("Unexpected collection"); });
    await runCollectionIfDue();
    assert.equal(mockFetch.mock.callCount(), 0);
    await pool.query("UPDATE monitor_sync SET next_attempt=NULL WHERE id=1");
    const holder = await pool.connect();
    try {
      await holder.query("SELECT pg_advisory_lock($1)", [7364921]);
      await runCollectionIfDue();
      assert.equal(mockFetch.mock.callCount(), 0);
    } finally {
      await holder.query("SELECT pg_advisory_unlock($1)", [7364921]);
      holder.release();
      mockFetch.mock.restore();
    }
  });

  await t.test("HTML upstream failure preserves snapshot and success time and schedules retry", async (ctx) => {
    const { rows: [before] } = await pool.query("SELECT snapshot, last_success FROM monitor_sync WHERE id=1");
    const mockFetch = ctx.mock.method(globalThis, "fetch", async () => new Response("<html>Unavailable</html>", {
      status: 200, headers: { "content-type": "text/html" },
    }));
    await runCollectionIfDue();
    mockFetch.mock.restore();
    const { rows: [after] } = await pool.query("SELECT * FROM monitor_sync WHERE id=1");
    assert.deepEqual(after.snapshot, before.snapshot);
    assert.deepEqual(after.last_success, before.last_success);
    assert.equal(after.running, false);
    assert.ok(after.last_error);
    assert.ok(after.next_attempt > new Date());
  });

  await t.test("schema-valid JSONB edits fail closed on both public endpoints", async () => {
    for (const path of ["{people,0,name}", "{people,0,metrics,documented_committee_meetings,value}", "{history,0,mk_count}"]) {
      await pool.query("UPDATE monitor_sync SET snapshot=$1::jsonb WHERE id=1", [JSON.stringify(pinned)]);
      await pool.query("UPDATE monitor_sync SET snapshot=jsonb_set(snapshot, $1::text[], $2::jsonb) WHERE id=1",
        [path, path.endsWith("name}") ? JSON.stringify("modified name") : "42"]);
      assert.equal((await fetch(`${url}/public-monitor/snapshot`)).status, 503);
      assert.equal((await fetch(`${url}/public-monitor/sync-status`)).status, 503);
    }
  });

  await t.test("invalid stored data fails closed rather than silently substituting the fallback", async () => {
    await pool.query("UPDATE monitor_sync SET snapshot='{}'::jsonb WHERE id=1");
    assert.equal((await fetch(`${url}/public-monitor/snapshot`)).status, 503);
    assert.equal((await fetch(`${url}/public-monitor/sync-status`)).status, 503);
    await pool.query("UPDATE monitor_sync SET snapshot=$1::jsonb WHERE id=1", [JSON.stringify(pinned)]);
  });
});
