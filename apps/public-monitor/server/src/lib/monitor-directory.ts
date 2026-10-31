import { csvRows, type Row, type SourceKey } from "./monitor-download";

const MK = new Set(["43", "61"]);
const GOV = new Set(["39", "57", "40", "59", "285079", "45", "50", "65", "51", "73", "31"]);
const MINISTER = new Set(["39", "57", "45"]);
const COMMITTEE = new Set(["41", "42", "66", "67"]);
const yes = (s: string) => ["true", "1"].includes(s?.toLowerCase());
const day = (s: string) => (s || "").slice(0, 10);
function validDate(s: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && Number.isFinite(Date.parse(s)) && new Date(s).toISOString().slice(0, 10) === s;
}
export function activeRole(r: Row, today: string) {
  for (const field of ["StartDate", "FinishDate"]) {
    if (r[field] && !validDate(day(r[field]))) throw new Error(`Invalid role date: ${field}`);
  }
  return yes(r.IsCurrent) && (!r.StartDate || day(r.StartDate) <= today) && (!r.FinishDate || day(r.FinishDate) >= today);
}
const nationalRole = (r: Row) => MK.has(r.PositionID) || GOV.has(r.PositionID);

export async function buildDirectory(files: Record<SourceKey, string>, today: string) {
  const read = async (key: SourceKey) => {
    const rows: Row[] = [];
    for await (const row of csvRows(files[key], key)) rows.push(row);
    return rows;
  };
  const [persons, roles, positions, offices] = await Promise.all(
    (["people", "roles", "positions", "ministries"] as SourceKey[]).map(read),
  );
  const personsById = new Map(persons.map((r) => [r.PersonID, r]));
  const labels = new Map(positions.map((r) => [r.PositionID, r.Description]));
  const active = roles.filter((r) => activeRole(r, today));
  const knesset = Math.max(...active.filter((r) => MK.has(r.PositionID)).map((r) => Number(r.KnessetNum)));
  const government = Math.max(...active.filter((r) => GOV.has(r.PositionID) && r.GovernmentNum).map((r) => Number(r.GovernmentNum)));
  if (!Number.isInteger(knesset) || knesset < 1 || !Number.isInteger(government) || government < 1) throw new Error("Missing source legislature/government");
  const current = active.filter((r) => GOV.has(r.PositionID) ? Number(r.GovernmentNum) === government : Number(r.KnessetNum) === knesset);
  const ids = [...new Set(current.filter(nationalRole).map((r) => r.PersonID))];
  function role(r: Row) {
    if (!labels.has(r.PositionID)) throw new Error("Unrecognized role label");
    return { id: r.PersonToPositionID, position_id: r.PositionID, title: labels.get(r.PositionID)!,
      organization: r.GovMinistryName || r.CommitteeName || "", ministry_id: r.GovMinistryID || null,
      start: day(r.StartDate), end: day(r.FinishDate), updated_at: r.LastUpdatedDate || "" };
  }
  const people = ids.map((id) => {
    const p = personsById.get(id);
    if (!p || !p.FirstName || !p.LastName) throw new Error("Missing source person");
    const assignments = current.filter((r) => r.PersonID === id);
    const relevant = assignments.filter(nationalRole);
    const mk = assignments.find((r) => MK.has(r.PositionID));
    return {
      id, name: `${p.FirstName} ${p.LastName}`, is_mk: !!mk,
      is_minister: relevant.some((r) => MINISTER.has(r.PositionID)),
      is_government: relevant.some((r) => GOV.has(r.PositionID)),
      faction: assignments.find((r) => r.PositionID === "54" && r.FactionName)?.FactionName || null,
      roles: relevant.map(role),
      role_history: roles.filter((r) => r.PersonID === id && nationalRole(r)).sort((a, b) => b.StartDate.localeCompare(a.StartDate)).slice(0, 12).map(role),
      committees: [...new Set(assignments.filter((r) => COMMITTEE.has(r.PositionID) && r.CommitteeName).map((r) => r.CommitteeName))].sort(),
      mk_start: mk ? day(mk.StartDate) : null,
      source_url: `https://oknesset.org/members/${encodeURIComponent(id)}.html`,
      source_row_updated_at: relevant.map((r) => r.LastUpdatedDate || "").sort().at(-1) || "",
      metrics: { current_attendance: null, vote_participation: null, service_results: null, composite_score: null,
        documented_committee_meetings: { value: null as number | null, start: "", end: "", status: "historical", is_attendance_rate: false } },
    };
  }).sort((a, b) => a.name.localeCompare(b.name, "he"));
  const ministries = offices.filter((r) => yes(r.IsActive) && Number(r.GovID) === government).map((r) => ({
    id: r.GovMinistryID, name: r.Name, government, source_row_updated_at: r.LastUpdatedDate,
    official_ids: people.filter((p) => p.roles.some((role) => role.ministry_id === r.GovMinistryID)).map((p) => p.id),
    director_general: null, metrics: { budget_execution: null, service_time: null, target_delivery: null },
  })).sort((a, b) => a.name.localeCompare(b.name, "he"));
  const count = people.filter((p) => p.is_mk).length;
  if (count < 100 || count > 120 || ministries.length < 10) throw new Error("Source roster failed completeness safeguards");
  return { people, ministries, knesset, government };
}

export async function addObservations(file: string, directory: Awaited<ReturnType<typeof buildDirectory>>, today: string) {
  let latest = "";
  for await (const row of csvRows(file, "attendance")) {
    if (Number(row.knesset_num) !== directory.knesset) continue;
    const d = day(row.meeting_start_date);
    if (!validDate(d)) throw new Error("Invalid committee event date");
    if (d <= today && d > latest) latest = d;
  }
  // Do not replace the last valid collection with a silently incomplete activity feed.
  if (!latest) throw new Error("No dated committee observations for source legislature");
  const start = new Date(Date.parse(latest) - 29 * 86400_000).toISOString().slice(0, 10);
  const seen = new Map(directory.people.map((p) => [p.id, new Set<string>()]));
  for await (const row of csvRows(file, "attendance")) {
    const d = day(row.meeting_start_date);
    if (Number(row.knesset_num) === directory.knesset && d >= start && d <= latest && seen.has(row.mk_id)) {
      if (!row.committee_id) throw new Error("Missing committee identifier");
      seen.get(row.mk_id)!.add(`${row.committee_id}|${row.meeting_start_date}`);
    }
  }
  for (const p of directory.people) {
    // Preserve historical eligibility: a new current tenure is not evidence of earlier attendance.
    const eligible = p.is_mk && p.mk_start && p.mk_start <= latest;
    p.metrics.documented_committee_meetings = { value: eligible ? seen.get(p.id)!.size : null,
      start, end: latest, status: "historical", is_attendance_rate: false };
  }
  return { status: "historical", start, end: latest, latest_event_at: latest };
}
