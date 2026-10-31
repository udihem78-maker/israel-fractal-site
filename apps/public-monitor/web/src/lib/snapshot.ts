import type { Person, PublicSnapshot, Role } from "@workspace/api-client-react";

export const heCollator = new Intl.Collator("he", { sensitivity: "base", numeric: true });
export const nf = new Intl.NumberFormat("he-IL");

export function safeUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : null;
  } catch {
    return null;
  }
}

export function cleanFaction(f: string | null | undefined) {
  const t = (f ?? "").trim();
  return t || "לא זמין";
}

/** Formats ISO date / datetime / HTTP-date into Hebrew-readable text. Returns null if empty. */
export function fmtDate(v: string | null | undefined, withTime = false): string | null {
  if (!v || !v.trim()) return null;
  const s = v.trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (m) return `${m[3]}.${m[2]}.${m[1]}`;
  const d = new Date(s);
  if (isNaN(d.getTime())) return s;
  const opts: Intl.DateTimeFormatOptions = { day: "2-digit", month: "2-digit", year: "numeric" };
  if (withTime) Object.assign(opts, { hour: "2-digit", minute: "2-digit", timeZone: "UTC", hour12: false });
  return d.toLocaleString("he-IL", opts) + (withTime ? " UTC" : "");
}

export function personType(p: Person): string[] {
  const t: string[] = [];
  if (p.is_mk) t.push("חבר/ת כנסת");
  if (p.is_minister) t.push("שר/ה");
  else if (p.is_government) t.push("תפקיד בממשלה");
  return t;
}

export type MeetingBin = { key: string; label: string; count: number; isNull?: boolean };

export function meetingBins(people: Person[]): MeetingBin[] {
  const bins: MeetingBin[] = [
    { key: "zero", label: "0", count: 0 },
    { key: "1-5", label: "1–5", count: 0 },
    { key: "6-10", label: "6–10", count: 0 },
    { key: "11+", label: "11+", count: 0 },
    { key: "null", label: "לא זמין / לא רלוונטי", count: 0, isNull: true },
  ];
  for (const p of people) {
    const v = p.metrics?.documented_committee_meetings?.value;
    if (v === null || v === undefined) bins[4].count++;
    else if (v === 0) bins[0].count++;
    else if (v <= 5) bins[1].count++;
    else if (v <= 10) bins[2].count++;
    else bins[3].count++;
  }
  return bins;
}

export function meetingWindows(people: Person[]) {
  const map = new Map<string, number>();
  for (const p of people) {
    const o = p.metrics?.documented_committee_meetings;
    if (!o) continue;
    const k = `${o.start}|${o.end}`;
    map.set(k, (map.get(k) ?? 0) + 1);
  }
  return [...map.entries()].map(([k, n]) => {
    const [start, end] = k.split("|");
    return { start, end, n };
  });
}

export function summarize(s: PublicSnapshot) {
  const ids = new Set(s.people.map((p) => p.id));
  const mk = s.people.filter((p) => p.is_mk).length;
  const gov = s.people.filter((p) => p.is_government).length;
  const minister = s.people.filter((p) => p.is_minister).length;
  const both = s.people.filter((p) => p.is_mk && p.is_government).length;
  const withCommittees = s.people.filter((p) => p.committees.length > 0).length;
  return { unique: ids.size, mk, gov, minister, both, withCommittees, ministries: s.ministries.length };
}

export const coverageLabels: Record<string, string> = {
  directors_general: "מנכ״לים של משרדי ממשלה",
  public_agency_heads: "ראשי רשויות וגופים ציבוריים",
  current_votes: "הצבעות עדכניות",
  current_attendance: "נוכחות עדכנית",
  ministry_outcomes: "תוצאות שירות ותקציב של משרדים",
};
export const coverageStatus: Record<string, string> = {
  not_connected: "לא מחובר",
  not_available_in_connected_source: "לא זמין במקור המחובר",
};
export const sourceLabels: Record<string, string> = {
  attendance: "תצפיות היסטוריות בישיבות ועדה (mk_attendance)",
  people: "רשימת חברי כנסת (mk_individual)",
  roles: "שיוך אנשים לתפקידים (kns_persontoposition)",
  positions: "טבלת תפקידים (kns_position)",
  ministries: "משרדי ממשלה (kns_govministry)",
};

export function rolesForMinistry(p: Person, ministryId: string): Role[] {
  return [...p.roles, ...p.role_history]
    .filter((r, i, arr) => r.ministry_id === ministryId && arr.findIndex((x) => x.id === r.id) === i);
}
