import assert from "node:assert/strict";
import { test } from "node:test";
import {
  loadPinnedSnapshot,
  sealSnapshot,
  validateSnapshot,
} from "./public-snapshot";
import { contentFreshness } from "./monitor-freshness";

for (const origin of ["pinned_repository", "direct_collection"] as const) {
  test(`${origin}: schema-valid content and history mutations fail checksum validation`, async () => {
    const good = sealSnapshot({
      ...(await loadPinnedSnapshot()),
      dataset_origin: origin,
    });
    for (const mutate of [
      (s: typeof good) => {
        s.people[0].name += " changed";
      },
      (s: typeof good) => {
        s.people[0].metrics.documented_committee_meetings.value = 42;
      },
      (s: typeof good) => {
        s.history[0].mk_count++;
      },
      (s: typeof good) => {
        s.history[0].source_activity_end = "2026-10-30";
      },
      (s: typeof good) => {
        s.sources.attendance.last_modified = "Sun, 01 Nov 2026 12:00:00 GMT";
      },
      (s: typeof good) => {
        s.snapshot_sha256 = "0".repeat(64);
      },
      (s: typeof good) => {
        s.history_sha256 = "0".repeat(64);
      },
    ]) {
      const changed = structuredClone(good);
      mutate(changed);
      assert.throws(
        () => validateSnapshot(changed),
        /integrity validation failed/,
      );
    }
  });
}

test("canonical checksums survive JSONB key reordering, round trips and runtime sync state", async () => {
  const good = await loadPinnedSnapshot();
  function reorder(v: any): any {
    if (Array.isArray(v)) return v.map(reorder);
    if (v && typeof v === "object")
      return Object.fromEntries(
        Object.entries(v)
          .reverse()
          .map(([k, x]) => [k, reorder(x)]),
      );
    return v;
  }
  assert.deepEqual(
    validateSnapshot(JSON.parse(JSON.stringify(reorder(good)))),
    good,
  );
  assert.equal(
    validateSnapshot({ ...good, sync_active: true }).sync_active,
    true,
  );
});

test("newly collected copies retain historical metrics and stale activity even with fresh HTTP headers", async () => {
  const now = new Date("2026-11-01T12:00:00Z");
  const raw = await loadPinnedSnapshot();
  raw.fetched_at = now.toISOString();
  raw.dataset_origin = "direct_collection";
  for (const source of Object.values(raw.sources))
    source.last_modified = now.toUTCString();
  const snapshot = validateSnapshot(sealSnapshot(raw));
  const freshness = contentFreshness(snapshot, now);
  const attendance = freshness.sources.find((s) => s.key === "attendance")!;
  assert.equal(attendance.http_modified.status, "within_threshold");
  assert.equal(attendance.activity.status, "stale");
  assert.equal(snapshot.activity.status, "historical");
  for (const person of snapshot.people) {
    assert.equal(
      person.metrics.documented_committee_meetings.status,
      "historical",
    );
    assert.equal(
      person.metrics.documented_committee_meetings.is_attendance_rate,
      false,
    );
    assert.equal(person.metrics.current_attendance, null);
    assert.equal(person.metrics.vote_participation, null);
    assert.equal(person.metrics.composite_score, null);
  }
});
