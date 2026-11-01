import assert from "node:assert/strict";
import { test } from "node:test";
import { once } from "node:events";
import { createServer } from "node:http";
import { listen } from "./server-listen";
import { runMigrations } from "../../../lib/db/src/migrate";
type MigrationPool = Parameters<typeof runMigrations>[0];

test("occupied port delivers EADDRINUSE through the error handler without starting collection", async (t) => {
  const occupied = createServer();
  occupied.listen(0, "127.0.0.1");
  await once(occupied, "listening");
  t.after(
    () => new Promise<void>((resolve) => occupied.close(() => resolve())),
  );
  const address = occupied.address();
  assert.ok(address && typeof address !== "string");
  let starts = 0;
  let failed!: ReturnType<typeof listen>;
  const err = await new Promise<NodeJS.ErrnoException>((resolve) => {
    failed = listen((_req, res) => res.end(), address.port, "127.0.0.1", {
      onListening: () => {
        starts++;
      },
      onError: resolve,
    });
  });
  t.after(() => failed.close());
  assert.equal(err.code, "EADDRINUSE");
  assert.equal(starts, 0);
  assert.equal(failed.listening, false);
});

test("successful listen invokes startup exactly once", async (t) => {
  let starts = 0;
  const server = listen((_req, res) => res.end(), 0, "127.0.0.1", {
    onListening: () => {
      starts++;
    },
    onError: (err) => {
      throw err;
    },
  });
  t.after(() => new Promise<void>((resolve) => server.close(() => resolve())));
  await once(server, "listening");
  assert.equal(starts, 1);
});

for (const failure of ["connect", "sql", "checksum", "rollback"] as const) {
  test(`migration ${failure} failure retains the original diagnostic and cleans up`, async () => {
    const original = Object.assign(
      new Error(`${failure} original diagnostic`),
      { code: "TEST_FAILURE" },
    );
    const rollback = new Error("rollback also failed");
    const queries: string[] = [];
    const errors: unknown[][] = [];
    let released = 0;
    let ended = 0;
    const client = {
      query: async (sql: string) => {
        queries.push(sql);
        if (sql === "ROLLBACK" && failure === "rollback") throw rollback;
        if (
          sql.startsWith("CREATE TABLE") &&
          ["sql", "rollback"].includes(failure)
        )
          throw original;
        return {
          rows:
            sql.startsWith("SELECT sha256") && failure === "checksum"
              ? [{ sha256: "changed" }]
              : [],
        };
      },
      release: () => {
        released++;
      },
    };
    const pool = {
      connect: async () => {
        if (failure === "connect") throw original;
        return client;
      },
      end: async () => {
        ended++;
      },
    } as unknown as MigrationPool;
    const ok = await runMigrations(pool, {
      ...console,
      info: () => {},
      error: (...args: unknown[]) => errors.push(args),
    });
    assert.equal(ok, false);
    assert.match(String(errors[0][0]), /Database migration failed/);
    if (failure === "checksum")
      assert.match(String(errors[0][1]), /Applied migration was changed/);
    else assert.equal(errors[0][1], original);
    assert.equal(queries.includes("COMMIT"), false);
    assert.equal(queries.includes("ROLLBACK"), failure !== "connect");
    assert.equal(released, failure === "connect" ? 0 : 1);
    assert.equal(ended, 1);
    if (failure === "rollback") assert.equal(errors[1][1], rollback);
  });
}
