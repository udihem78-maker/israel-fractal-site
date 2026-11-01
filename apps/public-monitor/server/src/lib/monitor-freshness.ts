import type { ContentFreshness, FreshnessSignal } from "@workspace/api-zod";

const DAY = 86_400_000;
// Local warning policy, not an upstream SLA. Compare UTC calendar days.
export const ACTIVITY_STALE_DAYS = 30;
export const HTTP_STALE_DAYS = 7;

export function freshnessSignal(date: string | null | undefined, threshold: number, now: Date): FreshnessSignal {
  const timestamp = date ? Date.parse(date) : NaN;
  const age = Math.floor(now.getTime() / DAY) - Math.floor(timestamp / DAY);
  if (!Number.isFinite(age) || timestamp > now.getTime()) {
    return { date: date || null, age_days: null, threshold_days: threshold, status: "unknown" };
  }
  return { date: date!, age_days: age, threshold_days: threshold, status: age > threshold ? "stale" : "within_threshold" };
}

export function contentFreshness(snapshot: {
  fetched_at: string;
  activity: { latest_event_at?: string | null };
  sources: Record<string, { last_modified: string | null }>;
}, now = new Date()): ContentFreshness {
  return {
    evaluated_at: now.toISOString(),
    snapshot_fetched_at: snapshot.fetched_at,
    sources: Object.entries(snapshot.sources).map(([key, source]) => ({
      key,
      // Role start/update dates and file headers must not become event dates.
      activity: freshnessSignal(key === "attendance" ? snapshot.activity.latest_event_at : null, ACTIVITY_STALE_DAYS, now),
      http_modified: freshnessSignal(source.last_modified, HTTP_STALE_DAYS, now),
    })),
  };
}
