import { createHash } from "node:crypto";
import { pool } from "@workspace/db";
import { logger } from "./logger";
import { loadPinnedSnapshot, validateSnapshot } from "./public-snapshot";
import { withSources } from "./monitor-download";
import { buildDirectory, addObservations } from "./monitor-directory";
import { contentFreshness } from "./monitor-freshness";

const DAY = 86400_000;
const RETRY = 3600_000;
const LOCK = 7364921;
let enabled = false;
let busy = false;
let timer: ReturnType<typeof setInterval> | undefined;
const digest = (v: unknown) => createHash("sha256").update(JSON.stringify(v)).digest("hex");
const iso = (value: Date | null) => value?.toISOString() ?? null;

export async function getSyncStatus() {
  const { rows: [state] } = await pool.query("SELECT last_attempt, last_success, next_attempt, last_error, running, snapshot FROM monitor_sync WHERE id = 1");
  const snapshot = state?.snapshot ? validateSnapshot(state.snapshot) : await loadPinnedSnapshot();
  return {
    enabled, running: !!state?.running,
    interval_hours: 24, retry_hours: 1,
    last_attempt: iso(state?.last_attempt), last_success: iso(state?.last_success),
    next_attempt: iso(state?.next_attempt), last_error: state?.last_error ?? null,
    freshness: contentFreshness(snapshot),
  };
}

export async function loadPublicSnapshot() {
  const { rows: [state] } = await pool.query("SELECT snapshot FROM monitor_sync WHERE id = 1");
  const snapshot = state?.snapshot ? validateSnapshot(state.snapshot) : await loadPinnedSnapshot();
  return { ...snapshot, sync_active: enabled };
}

// Due-time check inside a session advisory lock prevents duplicate workers across processes.
// The PostgreSQL session releases the lock on crash. No public mutation endpoint.
export async function runCollectionIfDue() {
  if (busy) return;
  busy = true;
  let client;
  let locked = false;
  try {
    client = await pool.connect();
    locked = (await client.query("SELECT pg_try_advisory_lock($1) AS locked", [LOCK])).rows[0].locked;
    if (!locked) return;
    await client.query("INSERT INTO monitor_sync (id) VALUES (1) ON CONFLICT DO NOTHING");
    const state = (await client.query("SELECT * FROM monitor_sync WHERE id = 1")).rows[0];
    // A stale running flag means the previous process stopped before completion.
    if (state.running) {
      await client.query("UPDATE monitor_sync SET running = false, last_error = $1 WHERE id = 1",
        ["האיסוף הקודם נקטע בעת עצירת השרת. העותק התקין האחרון נשמר."]);
    }
    if (state.next_attempt && state.next_attempt.getTime() > Date.now()) return;
    const attempt = new Date();
    await client.query("UPDATE monitor_sync SET running = true, last_attempt = $1, next_attempt = $2 WHERE id = 1",
      [attempt, new Date(attempt.getTime() + RETRY)]);
    try {
      const prior = state.snapshot ? validateSnapshot(state.snapshot) : await loadPinnedSnapshot();
      const collected = await withSources(async (files, sources) => {
        const now = new Date().toISOString();
        const directory = await buildDirectory(files, now.slice(0, 10));
        const activity = await addObservations(files.attendance, directory, now.slice(0, 10));
        if (Date.parse(activity.end) < Date.parse(prior.activity.end) || directory.knesset < prior.knesset || directory.government < prior.government) {
          throw new Error("Upstream regressed behind the last valid collection");
        }
        const entry = { date: now.slice(0, 10), fetched_at: now, source_activity_end: activity.end,
          mk_count: directory.people.filter((p) => p.is_mk).length, ministry_count: directory.ministries.length };
        const history = [...prior.history.filter((h) => h.date !== entry.date), entry]
          .sort((a, b) => a.date.localeCompare(b.date)).slice(-90);
        const raw = {
          ...directory, activity, sources, fetched_at: now, coverage: prior.coverage,
          roster_status: "secondary_source_not_independently_verified",
        };
        const result = {
          ...raw, history, repository: prior.repository, revision: prior.revision,
          snapshot_sha256: digest(raw), history_sha256: digest(history),
          imported_at: new Date().toISOString(), sync_active: true, dataset_origin: "direct_collection",
        };
        validateSnapshot(result);
        return result;
      });
      const success = new Date();
      // Data, history and success metadata switch together; failures never overwrite the old snapshot.
      await client.query(
        "UPDATE monitor_sync SET snapshot = $1::jsonb, last_success = $2, next_attempt = $3, last_error = NULL, running = false WHERE id = 1",
        [JSON.stringify(collected), success, new Date(success.getTime() + DAY)],
      );
      logger.info({ people: collected.people.length, ministries: collected.ministries.length, activityEnd: collected.activity.end }, "Public source collection validated and committed");
    } catch (err) {
      logger.error({ err }, "Public source collection failed; preserving last valid snapshot");
      await client.query("UPDATE monitor_sync SET running = false, last_error = $1, next_attempt = $2 WHERE id = 1",
        ["משיכת המקורות או אימותם נכשלו. העותק התקין האחרון נשמר; ניסיון נוסף בעוד כשעה.", new Date(Date.now() + RETRY)]);
    }
  } catch (err) {
    logger.error({ err }, "Public monitor scheduler unavailable");
  } finally {
    if (locked) await client?.query("SELECT pg_advisory_unlock($1)", [LOCK]).catch((err) => logger.error({ err }, "Collector lock release failed"));
    client?.release();
    busy = false;
  }
}

export function startMonitorSync() {
  if (enabled) return;
  if (process.env.MONITOR_SYNC_ENABLED !== "true") {
    logger.info("Collector disabled; set MONITOR_SYNC_ENABLED=true only for the authoritative worker");
    return;
  }
  enabled = true;
  void runCollectionIfDue();
  timer = setInterval(() => void runCollectionIfDue(), 60_000);
  timer.unref();
}

export function stopMonitorSync() {
  if (timer) clearInterval(timer);
  timer = undefined;
  enabled = false;
}
