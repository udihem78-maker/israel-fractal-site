import * as DialogPrimitive from "@radix-ui/react-dialog";
import { useRef } from "react";
import type { Ministry, Person, PublicSnapshot, Role } from "@workspace/api-client-react";
import { X, ExternalLink } from "lucide-react";
import { D, Note } from "@/components/shell";
import { cleanFaction, nf, personType, rolesForMinistry, safeUrl, heCollator } from "@/lib/snapshot";

export type Selection = { kind: "person"; id: string } | { kind: "ministry"; id: string } | null;

function ExtLink({ href, children, testid }: { href: string | null | undefined; children: React.ReactNode; testid: string }) {
  const u = safeUrl(href);
  if (!u) return <span className="text-muted-foreground">קישור אינו זמין</span>;
  return (
    <a href={u} target="_blank" rel="noopener noreferrer" data-testid={testid} className="inline-flex items-center gap-1 font-medium text-primary underline-offset-2 hover:underline">
      {children}
      <ExternalLink className="h-3.5 w-3.5" aria-hidden />
      <span className="sr-only">(נפתח בלשונית חדשה)</span>
    </a>
  );
}

function RoleTable({ roles, caption }: { roles: Role[]; caption: string }) {
  if (!roles.length) return <p className="text-sm text-muted-foreground">אין רשומות בעותק.</p>;
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead className="bg-muted/60 text-right">
          <tr>
            <th scope="col" className="p-2 font-semibold">תפקיד</th>
            <th scope="col" className="p-2 font-semibold">גוף</th>
            <th scope="col" className="p-2 font-semibold">התחלה</th>
            <th scope="col" className="p-2 font-semibold">סיום</th>
            <th scope="col" className="p-2 font-semibold">עדכון שורה</th>
          </tr>
        </thead>
        <tbody>
          {roles.map((r) => (
            <tr key={r.id} className="border-t">
              <td className="p-2 font-medium">{r.title}</td>
              <td className="p-2">{r.organization?.trim() || <span className="text-muted-foreground">—</span>}</td>
              <td className="p-2"><D v={r.start} /></td>
              <td className="p-2"><D v={r.end} fallback="לא נרשם סיום" /></td>
              <td className="p-2 text-muted-foreground"><D v={r.updated_at} fallback="—" /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className="text-base font-bold">{title}</h3>
      {children}
    </section>
  );
}

function PersonBody({ p, snap, onSelect }: { p: Person; snap: PublicSnapshot; onSelect: (s: Selection) => void }) {
  const o = p.metrics?.documented_committee_meetings;
  const ministries = snap.ministries.filter((m) => m.official_ids.includes(p.id));
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {personType(p).map((t) => <span key={t} className="rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-secondary-foreground">{t}</span>)}
        <span className="rounded-full border px-3 py-1 text-xs">סיעה: {cleanFaction(p.faction)}</span>
      </div>
      <Note tone="warn">
        תאריך סיום ריק פירושו שלא נרשם סיום במקור — <strong>אין זה אישור שהתפקיד נוכחי</strong>.
      </Note>
      <Section title="תפקידים ללא סיום רשום">
        <RoleTable roles={p.roles} caption="תפקידים ללא סיום רשום" />
      </Section>
      <Section title="היסטוריית תפקידים">
        <RoleTable roles={p.role_history} caption="היסטוריית תפקידים" />
      </Section>
      <Section title="ועדות">
        {p.committees.length ? (
          <ul className="flex flex-wrap gap-2">{p.committees.map((c) => <li key={c} className="rounded-md border bg-card px-2 py-1 text-sm">{c}</li>)}</ul>
        ) : <p className="text-sm text-muted-foreground">לא רשומות ועדות בעותק.</p>}
      </Section>
      <Section title="ישיבות ועדה מתועדות (חלון היסטורי)">
        <div className="rounded-lg border bg-card p-4">
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <span className="text-3xl font-extrabold text-primary" data-testid="text-person-meetings">
              {o?.value === null || o?.value === undefined ? "לא זמין" : nf.format(o.value)}
            </span>
            {o && <span className="text-sm text-muted-foreground">בחלון <D v={o.start} /> – <D v={o.end} /></span>}
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            מספר ישיבות ועדה ייחודיות שבהן מתועדת השתתפות במקור, בחלון זה בלבד. זה <strong>אינו</strong> שיעור נוכחות, אינו מדד יעילות ואינו הערכת ביצועים.
            {o?.value === 0 && " אפס פירושו שלא תועדו ישיבות בחלון — אין בכך הוכחה להיעדרות."}
            {(o?.value === null || o?.value === undefined) && " הערך אינו זמין (למשל כהונה שאינה בחלון ההיסטורי) — שונה מאפס."}
          </p>
        </div>
      </Section>
      {ministries.length > 0 && (
        <Section title="משרדים שבהם מופיע/ה">
          <ul className="flex flex-wrap gap-2">
            {ministries.map((m) => (
              <li key={m.id}>
                <button type="button" onClick={() => onSelect({ kind: "ministry", id: m.id })} className="rounded-md border bg-card px-2 py-1 text-sm text-primary hover:bg-secondary" data-testid={`button-open-ministry-${m.id}`}>{m.name}</button>
              </li>
            ))}
          </ul>
        </Section>
      )}
      <Section title="מקור">
        <dl className="grid gap-2 text-sm sm:grid-cols-[auto_1fr]">
          <dt className="text-muted-foreground">שורת מקור</dt><dd><ExtLink href={p.source_url} testid="link-person-source">רשומת המקור</ExtLink></dd>
          <dt className="text-muted-foreground">עדכון שורה במקור</dt><dd><D v={p.source_row_updated_at} time fallback="לא זמין" /></dd>
          <dt className="text-muted-foreground">תחילת כהונה בכנסת</dt><dd><D v={p.mk_start} fallback="לא זמין" /></dd>
          <dt className="text-muted-foreground">מזהה</dt><dd className="hash">{p.id}</dd>
        </dl>
      </Section>
    </div>
  );
}

function MinistryBody({ m, snap, onSelect }: { m: Ministry; snap: PublicSnapshot; onSelect: (s: Selection) => void }) {
  const byId = new Map(snap.people.map((p) => [p.id, p]));
  const people = m.official_ids.map((id) => ({ id, p: byId.get(id) }));
  people.sort((a, b) => heCollator.compare(a.p?.name ?? "", b.p?.name ?? ""));
  return (
    <div className="space-y-6">
      <dl className="grid gap-2 text-sm sm:grid-cols-[auto_1fr]">
        <dt className="text-muted-foreground">ממשלה במקור</dt><dd>{m.government}</dd>
        <dt className="text-muted-foreground">עדכון שורה במקור</dt><dd><D v={m.source_row_updated_at} time fallback="לא זמין" /></dd>
        <dt className="text-muted-foreground">קובץ מקור</dt><dd><ExtLink href={snap.sources?.ministries?.url} testid="link-ministry-source">קובץ משרדי הממשלה (CSV)</ExtLink></dd>
      </dl>
      <Section title={`נושאי תפקיד מקושרים (${nf.format(people.length)})`}>
        {people.length === 0 ? <p className="text-sm text-muted-foreground">אין נושאי תפקיד מקושרים למשרד זה בעותק.</p> : (
          <ul className="space-y-3">
            {people.map(({ id, p }) => (
              <li key={id} className="rounded-lg border bg-card p-3">
                {p ? (
                  <>
                    <button type="button" onClick={() => onSelect({ kind: "person", id })} className="font-semibold text-primary hover:underline" data-testid={`button-open-person-${id}`}>{p.name}</button>
                    <div className="mt-2"><RoleTable roles={rolesForMinistry(p, m.id)} caption={`תפקידי ${p.name} במשרד`} /></div>
                  </>
                ) : <span className="text-muted-foreground">מזהה <span className="hash">{id}</span> אינו מופיע ברשימת האנשים</span>}
              </li>
            ))}
          </ul>
        )}
      </Section>
      <Note tone="warn">
        לא מחוברים לעותק זה: מנכ״לים, תקציב וביצועו, ותוצאות שירות. היעדרם כאן אינו מעיד על קיומם או היעדרם במציאות.
      </Note>
    </div>
  );
}

export function DetailDialog({ sel, snap, onSelect }: { sel: Selection; snap: PublicSnapshot; onSelect: (s: Selection) => void }) {
  const returnFocus = useRef<HTMLElement | null>(null);
  const person = sel?.kind === "person" ? snap.people.find((p) => p.id === sel.id) : undefined;
  const ministry = sel?.kind === "ministry" ? snap.ministries.find((m) => m.id === sel.id) : undefined;
  const title = person?.name ?? ministry?.name ?? "";
  return (
    <DialogPrimitive.Root open={!!sel} onOpenChange={(o) => !o && onSelect(null)}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-[hsl(220_55%_14%/0.45)] data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          dir="rtl"
          onOpenAutoFocus={() => {
            returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            returnFocus.current?.focus();
          }}
          className="fixed inset-y-0 left-0 z-50 flex w-full max-w-2xl flex-col border-r bg-background data-[state=open]:animate-in data-[state=open]:slide-in-from-left"
          data-testid="dialog-detail"
        >
          <div className="flex items-start justify-between gap-3 border-b bg-card px-5 py-4">
            <div>
              <p className="text-xs font-semibold text-primary">{person ? "כרטיס אדם" : "כרטיס משרד"}</p>
              <DialogPrimitive.Title className="text-2xl font-extrabold">{title}</DialogPrimitive.Title>
              <DialogPrimitive.Description className="text-sm text-muted-foreground">
                מתוך עותק שמור שלא אומת באופן עצמאי
              </DialogPrimitive.Description>
            </div>
            <DialogPrimitive.Close className="rounded-md p-2 hover:bg-muted" aria-label="סגירה" data-testid="button-close-detail">
              <X className="h-5 w-5" />
            </DialogPrimitive.Close>
          </div>
          <div className="flex-1 overflow-y-auto px-5 py-5">
            {person && <PersonBody p={person} snap={snap} onSelect={onSelect} />}
            {ministry && <MinistryBody m={ministry} snap={snap} onSelect={onSelect} />}
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
