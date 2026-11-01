import { test } from "node:test";
import assert from "node:assert/strict";
import { contentFreshness, freshnessSignal } from "./monitor-freshness";

const now = new Date("2026-10-30T12:00:00Z");
test("UTC thresholds are strict and retain a real zero age", () => {
  for (const threshold of [7, 30]) {
    const date = new Date(now.getTime() - threshold * 86_400_000).toISOString();
    assert.equal(freshnessSignal(date, threshold, now).status, "within_threshold");
    assert.equal(freshnessSignal(date, threshold - 1, now).status, "stale");
  }
  assert.equal(freshnessSignal(now.toISOString(), 7, now).age_days, 0);
  assert.equal(freshnessSignal("2026-10-22T23:59:59Z", 7, now).status, "stale");
});

test("missing, malformed and future dates are unknown, not stale or zero", () => {
  for (const date of [null, undefined, "", "invalid", "2027-01-01"]) {
    const signal = freshnessSignal(date, 30, now);
    assert.equal(signal.status, "unknown");
    assert.equal(signal.age_days, null);
  }
});

test("new collection and new HTTP header cannot hide old committee events", () => {
  const snapshot = {
    fetched_at: now.toISOString(),
    activity: { latest_event_at: "2025-08-11" },
    sources: { attendance: { last_modified: now.toUTCString() }, people: { last_modified: null } },
  };
  const result = contentFreshness(snapshot, now);
  assert.equal(result.sources[0].activity.status, "stale");
  assert.equal(result.sources[0].http_modified.status, "within_threshold");
  assert.equal(result.sources[1].activity.status, "unknown");
  assert.equal(result.sources[1].http_modified.age_days, null);
  assert.equal(contentFreshness({ ...snapshot, activity: { latest_event_at: null } }, now).sources[0].activity.status, "unknown");
  assert.equal(contentFreshness(snapshot, new Date("2026-11-10")).sources[0].http_modified.status, "stale");
});
