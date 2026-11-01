import { useMemo, useState } from "react";
import type { PublicSnapshot } from "@workspace/api-client-react";
import { Search, RotateCcw, ChevronLeft, ChevronRight, Users, Building2 } from "lucide-react";
import { SnapshotGate } from "@/components/gate";
import { PageHeader, Note } from "@/components/shell";
import { DetailDialog, type Selection } from "@/components/detail-dialog";
import { cleanFaction, heCollator, nf, personType } from "@/lib/snapshot";

const PAGE = 12;
const fieldCls = "w-full rounded-md border border-input bg-card px-3 py-2 text-sm";

function Pager({ page, pages, setPage, total, label }: { page: number; pages: number; setPage: (n: number) => void; total: number; label: string }) {
  return (
    <nav aria-label={`עימוד ${label}`} className="flex flex-wrap items-center justify-between gap-3 text-sm">
      <p aria-live="polite">{nf.format(total)} תוצאות · עמוד {nf.format(page + 1)} מתוך {nf.format(Math.max(pages, 1))}</p>
      <div className="flex gap-2">
        <button type="button" disabled={page === 0} onClick={() => setPage(page - 1)} className="inline-flex items-center gap-1 rounded-md border bg-card px-3 py-1.5 disabled:opacity-40" data-testid={`button-prev-${label}`}>
          <ChevronRight className="h-4 w-4" aria-hidden /> הקודם
        </button>
        <button type="button" disabled={page >= pages - 1} onClick={() => setPage(page + 1)} className="inline-flex items-center gap-1 rounded-md border bg-card px-3 py-1.5 disabled:opacity-40" data-testid={`button-next-${label}`}>
          הבא <ChevronLeft className="h-4 w-4" aria-hidden />
        </button>
      </div>
    </nav>
  );
}

function Directory({ s }: { s: PublicSnapshot }) {
  const [tab, setTab] = useState<"people" | "ministries">("people");
  const [sel, setSel] = useState<Selection>(null);
  const [q, setQ] = useState("");
  const [faction, setFaction] = useState("all");
  const [type, setType] = useState("all");
  const [page, setPage] = useState(0);
  const [mq, setMq] = useState("");
  const [mLinked, setMLinked] = useState("all");
  const [mPage, setMPage] = useState(0);

  const factions = useMemo(() => [...new Set(s.people.map((p) => cleanFaction(p.faction)))].sort(heCollator.compare), [s]);
  const people = useMemo(() => {
    const t = q.trim();
    return s.people
      .filter((p) => !t || p.name.includes(t) || cleanFaction(p.faction).includes(t) || p.committees.some((c) => c.includes(t)))
      .filter((p) => faction === "all" || cleanFaction(p.faction) === faction)
      .filter((p) =>
        type === "all" ? true : type === "mk" ? p.is_mk : type === "gov" ? p.is_government : type === "minister" ? p.is_minister : p.is_mk && p.is_government,
      )
      .sort((a, b) => heCollator.compare(a.name, b.name));
  }, [s, q, faction, type]);
  const ministries = useMemo(() => {
    const t = mq.trim();
    return s.ministries
      .filter((m) => !t || m.name.includes(t))
      .filter((m) => (mLinked === "all" ? true : mLinked === "yes" ? m.official_ids.length > 0 : m.official_ids.length === 0))
      .sort((a, b) => heCollator.compare(a.name, b.name));
  }, [s, mq, mLinked]);
  const nameById = useMemo(() => new Map(s.people.map((p) => [p.id, p.name])), [s]);

  const pPages = Math.ceil(people.length / PAGE);
  const mPages = Math.ceil(ministries.length / PAGE);
  const reset = () => { setQ(""); setFaction("all"); setType("all"); setPage(0); };

  return (
    <>
      <PageHeader eyebrow="מדריך" title="אנשים ומשרדים">
        מיון ברירת מחדל: אלפביתי בעברית. לחיצה על שורה פותחת כרטיס מפורט עם תפקידים, תאריכים ומקור.
      </PageHeader>
      <div className="mx-auto max-w-6xl space-y-6 px-4 py-8">
        <div role="tablist" aria-label="סוג רשומה" className="inline-flex rounded-lg border bg-card p-1">
          {([["people", "אנשים", Users, s.people.length], ["ministries", "משרדים", Building2, s.ministries.length]] as const).map(([k, l, Icon, n]) => (
            <button key={k} role="tab" type="button" aria-selected={tab === k} aria-controls={`panel-${k}`} id={`tab-${k}`} onClick={() => setTab(k)}
              tabIndex={tab === k ? 0 : -1}
              onKeyDown={(event) => {
                if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
                event.preventDefault();
                const next = event.key === "Home" ? "people" : event.key === "End" ? "ministries" : tab === "people" ? "ministries" : "people";
                setTab(next);
                document.getElementById(`tab-${next}`)?.focus();
              }}
              data-testid={`tab-${k}`}
              className={`inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold transition ${tab === k ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>
              <Icon className="h-4 w-4" aria-hidden /> {l} <span className="opacity-80">({nf.format(n)})</span>
            </button>
          ))}
        </div>

        {tab === "people" ? (
          <div role="tabpanel" id="panel-people" aria-labelledby="tab-people" className="space-y-4">
            <div className="grid gap-3 rounded-xl border bg-card p-4 md:grid-cols-[2fr_1fr_1fr_auto] md:items-end">
              <div>
                <label htmlFor="q" className="mb-1 block text-sm font-medium">חיפוש לפי שם, סיעה או ועדה</label>
                <div className="relative">
                  <Search className="pointer-events-none absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" aria-hidden />
                  <input id="q" type="search" value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} className={`${fieldCls} pr-9`} data-testid="input-search-people" />
                </div>
              </div>
              <div>
                <label htmlFor="faction" className="mb-1 block text-sm font-medium">סיעה</label>
                <select id="faction" value={faction} onChange={(e) => { setFaction(e.target.value); setPage(0); }} className={fieldCls} data-testid="select-faction">
                  <option value="all">כל הסיעות</option>
                  {factions.map((f) => <option key={f} value={f}>{f}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="type" className="mb-1 block text-sm font-medium">סוג</label>
                <select id="type" value={type} onChange={(e) => { setType(e.target.value); setPage(0); }} className={fieldCls} data-testid="select-type">
                  <option value="all">הכול</option>
                  <option value="mk">חברי כנסת</option>
                  <option value="gov">בעלי תפקידים בממשלה</option>
                  <option value="minister">שרים</option>
                  <option value="both">גם כנסת וגם ממשלה</option>
                </select>
              </div>
              <button type="button" onClick={reset} className="inline-flex items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm font-medium hover:bg-muted" data-testid="button-reset-filters">
                <RotateCcw className="h-4 w-4" aria-hidden /> איפוס
              </button>
            </div>
            {people.length === 0 ? (
              <div className="rounded-xl border border-dashed bg-card p-10 text-center">
                <p className="font-semibold">לא נמצאו אנשים התואמים לסינון.</p>
                <button type="button" onClick={reset} className="mt-3 text-sm font-medium text-primary underline" data-testid="button-reset-empty">איפוס הסינון</button>
              </div>
            ) : (
              <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {people.slice(page * PAGE, page * PAGE + PAGE).map((p) => {
                  const v = p.metrics?.documented_committee_meetings?.value;
                  return (
                    <li key={p.id}>
                      <button type="button" onClick={() => setSel({ kind: "person", id: p.id })} data-testid={`card-person-${p.id}`}
                        className="group h-full w-full rounded-xl border bg-card p-4 text-right transition hover:-translate-y-0.5 hover:border-primary/50">
                        <span className="block text-lg font-bold group-hover:text-primary">{p.name}</span>
                        <span className="block text-sm text-muted-foreground">{cleanFaction(p.faction)}</span>
                        <span className="mt-3 flex flex-wrap gap-1.5">
                          {personType(p).map((t) => <span key={t} className="rounded-full bg-secondary px-2 py-0.5 text-xs font-semibold text-secondary-foreground">{t}</span>)}
                          <span className="rounded-full border px-2 py-0.5 text-xs">{nf.format(p.committees.length)} ועדות</span>
                          <span className="rounded-full border px-2 py-0.5 text-xs">ישיבות מתועדות: {v === null || v === undefined ? "לא זמין" : nf.format(v)}</span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
            <Pager page={page} pages={pPages} setPage={setPage} total={people.length} label="people" />
          </div>
        ) : (
          <div role="tabpanel" id="panel-ministries" aria-labelledby="tab-ministries" className="space-y-4">
            <div className="grid gap-3 rounded-xl border bg-card p-4 md:grid-cols-[2fr_1fr_auto] md:items-end">
              <div>
                <label htmlFor="mq" className="mb-1 block text-sm font-medium">חיפוש משרד</label>
                <input id="mq" type="search" value={mq} onChange={(e) => { setMq(e.target.value); setMPage(0); }} className={fieldCls} data-testid="input-search-ministries" />
              </div>
              <div>
                <label htmlFor="mlinked" className="mb-1 block text-sm font-medium">נושאי תפקיד מקושרים</label>
                <select id="mlinked" value={mLinked} onChange={(e) => { setMLinked(e.target.value); setMPage(0); }} className={fieldCls} data-testid="select-ministry-linked">
                  <option value="all">הכול</option>
                  <option value="yes">עם נושאי תפקיד</option>
                  <option value="no">ללא נושאי תפקיד בעותק</option>
                </select>
              </div>
              <button type="button" onClick={() => { setMq(""); setMLinked("all"); setMPage(0); }} className="inline-flex items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm font-medium hover:bg-muted" data-testid="button-reset-ministries">
                <RotateCcw className="h-4 w-4" aria-hidden /> איפוס
              </button>
            </div>
            <Note>לא מחוברים: מנכ״לים, תקציבים ותוצאות שירות של המשרדים.</Note>
            {ministries.length === 0 ? (
              <div className="rounded-xl border border-dashed bg-card p-10 text-center font-semibold">לא נמצאו משרדים התואמים לסינון.</div>
            ) : (
              <ul className="grid gap-3 sm:grid-cols-2">
                {ministries.slice(mPage * PAGE, mPage * PAGE + PAGE).map((m) => (
                  <li key={m.id}>
                    <button type="button" onClick={() => setSel({ kind: "ministry", id: m.id })} data-testid={`card-ministry-${m.id}`}
                      className="group h-full w-full rounded-xl border bg-card p-4 text-right transition hover:-translate-y-0.5 hover:border-primary/50">
                      <span className="block font-bold group-hover:text-primary">{m.name}</span>
                      <span className="mt-1 block text-sm text-muted-foreground">
                        {m.official_ids.length ? m.official_ids.map((id) => nameById.get(id) ?? id).join(" · ") : "אין נושאי תפקיד מקושרים בעותק"}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <Pager page={mPage} pages={mPages} setPage={setMPage} total={ministries.length} label="ministries" />
          </div>
        )}
      </div>
      <DetailDialog sel={sel} snap={s} onSelect={setSel} />
    </>
  );
}

export default function DirectoryPage() {
  return <SnapshotGate>{(s) => <Directory s={s} />}</SnapshotGate>;
}
