import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { GetPublicSnapshotResponse } from "@workspace/api-zod";
import { pinnedDataDirectory as dataDirectory } from "../paths";

// Keep the hash-checked fallback outside the bundle for dev and production.
const revision = "dbd36bd26042d93ff8d3fcfc1eef8bf3abb36296";
const sha256 = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");

export async function loadPinnedSnapshot() {
  const [nationalBytes, historyBytes, manifestBytes] = await Promise.all(
    ["national.json", "history.json", "manifest.json"].map((file) =>
      readFile(new URL(file, dataDirectory)),
    ),
  );
  const manifest = JSON.parse(manifestBytes.toString("utf8"));
  if (
    manifest.revision !== revision ||
    manifest.sync_active !== false ||
    sha256(nationalBytes) !== manifest.snapshot_sha256 ||
    sha256(historyBytes) !== manifest.history_sha256
  ) {
    throw new Error("Pinned snapshot integrity validation failed");
  }
  const raw = JSON.parse(nationalBytes.toString("utf8"));
  return validateSnapshot(sealSnapshot({
    ...raw,
    ...manifest,
    history: JSON.parse(historyBytes.toString("utf8")),
    dataset_origin: "pinned_repository",
  }));
}

// Hash the normalized API payload. Sorted object keys survive JSONB reordering;
// array order and explicit null values remain significant. Runtime sync state is
// excluded because readers set it independently of the collected content.
export function canonicalDigest(value: unknown): string {
  const canonical = (v: any): any => Array.isArray(v)
    ? v.map(canonical)
    : v !== null && typeof v === "object"
      ? Object.fromEntries(Object.keys(v).sort().filter((key) => v[key] !== undefined)
        .map((key) => [key, canonical(v[key])]))
      : v;
  return createHash("sha256").update(JSON.stringify(canonical(value))).digest("hex");
}

function checksums(snapshot: ReturnType<typeof GetPublicSnapshotResponse.parse>) {
  const { snapshot_sha256, history_sha256, history, sync_active, ...payload } = snapshot;
  return { snapshot_sha256: canonicalDigest(payload), history_sha256: canonicalDigest(history) };
}

// Use only after verifying bundled bytes or collecting/validating new sources,
// never on a database read: re-sealing a stored record would hide corruption.
export function sealSnapshot(raw: unknown) {
  const snapshot = GetPublicSnapshotResponse.parse(raw);
  return { ...snapshot, ...checksums(snapshot) };
}

export function validateSnapshot(raw: any) {
  const snapshot = GetPublicSnapshotResponse.parse(raw);
  const expected = checksums(snapshot);
  if (snapshot.snapshot_sha256 !== expected.snapshot_sha256 ||
      snapshot.history_sha256 !== expected.history_sha256) {
    throw new Error("Stored snapshot integrity validation failed");
  }
  if (
    snapshot.roster_status !== "secondary_source_not_independently_verified" ||
    snapshot.activity.status !== "historical" ||
    !Number.isFinite(Date.parse(snapshot.fetched_at)) ||
    snapshot.people.length === 0 ||
    new Set(snapshot.people.map((p) => p.id)).size !== snapshot.people.length ||
    new Set(snapshot.ministries.map((m) => m.id)).size !== snapshot.ministries.length
  ) {
    throw new Error("Invalid source roster or collection metadata");
  }
  const peopleIds = new Set(snapshot.people.map((person) => person.id));
  for (const person of snapshot.people) {
    const metric = person.metrics.documented_committee_meetings;
    if (
      (metric.value !== null && metric.value < 0) ||
      metric.is_attendance_rate !== false ||
      metric.status !== "historical" ||
      metric.start !== snapshot.activity.start ||
      metric.end !== snapshot.activity.end
    ) {
      throw new Error("Inconsistent historical observation window");
    }
    for (const key of ["current_attendance", "vote_participation", "service_results", "composite_score"]) {
      const original = raw.people.find((entry: { id: string }) => entry.id === person.id);
      if (original.metrics[key] !== null) throw new Error("Unexpected connected metric");
    }
    const link = new URL(person.source_url);
    if (link.protocol !== "https:" || link.hostname !== "oknesset.org") {
      throw new Error("Invalid person provenance URL");
    }
  }
  for (const ministry of snapshot.ministries) {
    if (ministry.official_ids.some((id) => !peopleIds.has(id))) {
      throw new Error("Unknown ministry officeholder");
    }
  }
  for (const source of Object.values(snapshot.sources)) {
    const link = new URL(source.url);
    if (link.protocol !== "https:" || link.hostname !== "production.oknesset.org") {
      throw new Error("Invalid secondary source URL");
    }
    if (!/^[a-f0-9]{64}$/.test(source.sha256)) throw new Error("Invalid source hash");
  }
  return snapshot;
}
