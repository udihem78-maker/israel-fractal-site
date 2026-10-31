import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { activeRole, addObservations, buildDirectory } from "./monitor-directory";
import { csvRows } from "./monitor-download";
import { loadPinnedSnapshot, validateSnapshot } from "./public-snapshot";

test("role selection excludes expired/future appointments and rejects malformed dates", () => {
  const r = { IsCurrent: "True", StartDate: "2026-01-01", FinishDate: "" };
  assert.equal(activeRole(r, "2026-10-30"), true);
  assert.equal(activeRole({ ...r, StartDate: "2027-01-01" }, "2026-10-30"), false);
  assert.equal(activeRole({ ...r, FinishDate: "2026-01-02" }, "2026-10-30"), false);
  assert.throws(() => activeRole({ ...r, StartDate: "2026-02-31" }, "2026-10-30"));
});

test("CSV HTML, missing schema and missing file fail closed", async () => {
  const dir = await mkdtemp(join(tmpdir(), "monitor-test-"));
  try {
    for (const text of ["<html>Unavailable</html>", "unexpected,columns\n1,2"]) {
      await writeFile(join(dir, "invalid"), text);
      await assert.rejects(async () => { for await (const _r of csvRows(join(dir, "invalid"), "people")) { /* consume */ } });
    }
    await assert.rejects(async () => { for await (const _r of csvRows(join(dir, "missing"), "people")) { /* consume */ } });
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test("historical observations deduplicate meetings, preserve zero/null and ignore future events", async () => {
  const dir = await mkdtemp(join(tmpdir(), "monitor-test-"));
  try {
    const file = join(dir, "attendance");
    await writeFile(file, "knesset_num,committee_id,meeting_start_date,mk_id\n25,1,2025-08-11 10:00:00,a\n25,1,2025-08-11 10:00:00,a\n25,2,2025-08-11 10:00:00,a\n25,3,2027-01-01 10:00:00,a\n24,4,2026-01-01,b\n");
    const people = [
      { id: "a", is_mk: true, mk_start: "2020-01-01", metrics: {} },
      { id: "b", is_mk: true, mk_start: "2020-01-01", metrics: {} },
      { id: "new", is_mk: true, mk_start: "2026-01-01", metrics: {} },
      { id: "gov", is_mk: false, mk_start: null, metrics: {} },
    ];
    const directory = { people, knesset: 25 } as Awaited<ReturnType<typeof buildDirectory>>;
    const activity = await addObservations(file, directory, "2026-10-30");
    assert.equal(activity.start, "2025-07-13");
    assert.equal(activity.end, "2025-08-11");
    assert.deepEqual(directory.people.map((p) => p.metrics.documented_committee_meetings.value), [2, 0, null, null]);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test("invalid new collection is rejected before replacing the stored snapshot", async () => {
  const base = JSON.parse(await readFile(new URL("../../data/public-monitor/national.json", import.meta.url), "utf8"));
  const history = JSON.parse(await readFile(new URL("../../data/public-monitor/history.json", import.meta.url), "utf8"));
  const manifest = JSON.parse(await readFile(new URL("../../data/public-monitor/manifest.json", import.meta.url), "utf8"));
  const valid = { ...base, ...manifest, history };
  assert.equal(validateSnapshot(valid).people.length, base.people.length);
  const invalid = structuredClone(valid);
  invalid.people[0].metrics.documented_committee_meetings.value = -1;
  assert.throws(() => validateSnapshot(invalid));
  invalid.people[0].metrics.documented_committee_meetings.value = null;
  invalid.people[0].source_url = "https://untrusted.example";
  assert.throws(() => validateSnapshot(invalid));
  assert.deepEqual(valid.people, base.people);
});

test("validated snapshots retain null metrics and can be validated after persistence", async () => {
  const pinned = await loadPinnedSnapshot();
  const roundTrip = validateSnapshot(JSON.parse(JSON.stringify(pinned)));
  assert.equal(roundTrip.people[0].metrics.current_attendance, null);
  assert.equal(roundTrip.people[0].metrics.composite_score, null);
  assert.equal(roundTrip.ministries[0].director_general, null);
  assert.equal(roundTrip.ministries[0].metrics.budget_execution, null);
});
