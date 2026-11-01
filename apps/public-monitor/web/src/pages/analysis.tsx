import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { SnapshotGate } from "@/components/gate";
import { D, Note, PageHeader } from "@/components/shell";
import { meetingBins, meetingWindows, nf, summarize } from "@/lib/snapshot";

const BLUE = "#1F74AD";
const tick = { fontSize: 13, fill: "#3d4a63" };

function Tip({ active, payload, label, unit }: { active?: boolean; payload?: { value: number }[]; label?: string; unit: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div dir="rtl" className="rounded-md border bg-card px-3 py-2 text-[13px]">
      <div className="font-semibold">{label}</div>
      <div>{nf.format(payload[0].value)} {unit}</div>
    </div>
  );
}

function Card({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="space-y-4 rounded-xl border bg-card p-5 md:p-6">
      <h2 id={id} className="text-xl font-bold">{title}</h2>
      {children}
    </section>
  );
}

export default function Analysis() {
  return (
    <SnapshotGate>
      {(s) => {
        const sum = summarize(s);
        const coverage = [
          { label: "חברי כנסת", value: sum.mk },
          { label: "תפקידים בממשלה", value: sum.gov },
          { label: "שרים", value: sum.minister },
          { label: "עם ועדה רשומה", value: sum.withCommittees },
        ];
        const bins = meetingBins(s.people);
        const windows = meetingWindows(s.people);
        const hist = [...(s.history ?? [])].sort((a, b) => a.date.localeCompare(b.date));
        return (
          <>
            <PageHeader eyebrow="ניתוח" title="כיסוי הנתונים, לא דירוג">
              התרשימים כאן מתארים מה נמצא בעותק — לא מדרגים אנשים או סיעות ולא מעריכים ביצועים.
            </PageHeader>
            <div className="mx-auto max-w-6xl space-y-8 px-4 py-8">
              <Card id="h-cov" title="כיסוי תפקידים ומשרות">
                <Note tone="warn">
                  הקטגוריות חופפות — אדם יכול להיספר ביותר מעמודה אחת. אין לחבר את הערכים. מספר האנשים הייחודיים: {nf.format(sum.unique)}.
                </Note>
                <div dir="ltr" className="h-[260px]" aria-hidden>
                  <ResponsiveContainer width="100%" height="100%" debounce={0}>
                    <BarChart data={coverage} layout="vertical" margin={{ left: 8, right: 16 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e1e7f0" horizontal={false} />
                      <XAxis type="number" domain={[0, "auto"]} allowDecimals={false} reversed tick={tick} />
                      <YAxis type="category" dataKey="label" orientation="right" width={120} tick={tick} />
                      <Tooltip content={<Tip unit="אנשים" />} cursor={false} isAnimationActive={false} />
                      <Bar dataKey="value" fill={BLUE} isAnimationActive={false} radius={[3, 0, 0, 3]}>
                        <LabelList dataKey="value" position="inside" style={{ fontSize: 13, fill: "#fff", direction: "ltr" }} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <details className="text-sm">
                  <summary className="cursor-pointer font-medium text-primary">טבלת הנתונים של התרשים</summary>
                  <table className="mt-2 w-full max-w-md border text-sm">
                    <caption className="sr-only">כיסוי תפקידים (קטגוריות חופפות)</caption>
                    <thead className="bg-muted/60"><tr><th scope="col" className="p-2 text-right">קטגוריה</th><th scope="col" className="p-2 text-right">אנשים</th></tr></thead>
                    <tbody>{coverage.map((c) => <tr key={c.label} className="border-t"><td className="p-2">{c.label}</td><td className="p-2">{nf.format(c.value)}</td></tr>)}</tbody>
                  </table>
                </details>
              </Card>

              <Card id="h-dist" title="התפלגות ישיבות ועדה מתועדות (היסטורי)">
                <p className="text-sm text-muted-foreground">
                  מספר האנשים בכל טווח של ישיבות ועדה ייחודיות מתועדות, בחלון{" "}
                  {windows.map((w, i) => <span key={i}>{i > 0 && " / "}<D v={w.start} />–<D v={w.end} />{windows.length > 1 && ` (${nf.format(w.n)})`}</span>)}.
                  {windows.length > 1 && " שימו לב: נמצאו כמה חלונות שונים."}
                </p>
                <Note tone="warn">
                  זה אינו שיעור נוכחות ואינו מדד ביצועים. אפס פירושו שלא תועדו ישיבות בחלון — לא הוכחה להיעדרות.
                  &quot;לא זמין&quot; (null) מוצג בנפרד ושונה מאפס.
                </Note>
                <div dir="ltr" className="h-[280px]" aria-hidden>
                  <ResponsiveContainer width="100%" height="100%" debounce={0}>
                    <BarChart data={bins} margin={{ top: 20, left: 0, right: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e1e7f0" vertical={false} />
                      <XAxis dataKey="label" tick={tick} interval={0} />
                      <YAxis domain={[0, "auto"]} allowDecimals={false} tick={tick} width={36} />
                      <Tooltip content={<Tip unit="אנשים" />} cursor={false} isAnimationActive={false} />
                      <Bar dataKey="count" fill={BLUE} isAnimationActive={false} radius={[3, 3, 0, 0]}>
                        <LabelList dataKey="count" position="top" style={{ fontSize: 13, fill: "#1b2540" }} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <details className="text-sm">
                  <summary className="cursor-pointer font-medium text-primary">טבלת הנתונים של התרשים</summary>
                  <table className="mt-2 w-full max-w-md border text-sm">
                    <caption className="sr-only">התפלגות ישיבות ועדה מתועדות</caption>
                    <thead className="bg-muted/60"><tr><th scope="col" className="p-2 text-right">טווח ישיבות</th><th scope="col" className="p-2 text-right">אנשים</th></tr></thead>
                    <tbody>{bins.map((b) => <tr key={b.key} className="border-t"><td className="p-2">{b.label}</td><td className="p-2">{nf.format(b.count)}</td></tr>)}</tbody>
                  </table>
                </details>
              </Card>

              <Card id="h-hist" title="היסטוריית איסוף">
                {hist.length < 2 && (
                  <Note>
                    קיימת {hist.length === 1 ? "תצפית אחת בלבד" : "אין תצפיות"} — לא ניתן להציג מגמה. מגמה תדרוש כמה איסופים מתועדים לאורך זמן.
                  </Note>
                )}
                {hist.length === 0 ? (
                  <p className="text-sm text-muted-foreground">אין רשומות היסטוריה בעותק.</p>
                ) : (
                  <div className="overflow-x-auto rounded-lg border">
                    <table className="w-full text-sm">
                      <caption className="sr-only">תצפיות איסוף מתוארכות</caption>
                      <thead className="bg-muted/60 text-right">
                        <tr>
                          <th scope="col" className="p-2">תאריך</th><th scope="col" className="p-2">נאסף</th>
                          <th scope="col" className="p-2">סוף פעילות במקור</th><th scope="col" className="p-2">חברי כנסת</th><th scope="col" className="p-2">משרדים</th>
                        </tr>
                      </thead>
                      <tbody>
                        {hist.map((h) => (
                          <tr key={h.fetched_at} className="border-t">
                            <td className="p-2"><D v={h.date} /></td><td className="p-2"><D v={h.fetched_at} time /></td>
                            <td className="p-2"><D v={h.source_activity_end} fallback="לא זמין" /></td>
                            <td className="p-2">{nf.format(h.mk_count)}</td><td className="p-2">{nf.format(h.ministry_count)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>
            </div>
          </>
        );
      }}
    </SnapshotGate>
  );
}
