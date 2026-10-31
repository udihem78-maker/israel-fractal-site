import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";
import { SnapshotGate } from "@/components/gate";
import { D, IsraelFlag, Note } from "@/components/shell";
import { nf, summarize } from "@/lib/snapshot";
import { SyncStatus } from "@/components/sync-status";

function Stat({ label, value, hint, testid }: { label: string; value: number; hint: string; testid: string }) {
  return (
    <div className="rounded-xl border bg-card p-5 transition hover:-translate-y-0.5 hover:border-primary/40">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-4xl font-extrabold tracking-tight text-primary" data-testid={testid}>{nf.format(value)}</p>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

export default function Overview() {
  return (
    <SnapshotGate>
      {(s) => {
        const sum = summarize(s);
        return (
          <>
            <section className="civic-grid relative overflow-hidden border-b bg-gradient-to-b from-secondary/70 to-background">
              <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 md:grid-cols-[1fr_auto] md:items-center">
                <div className="rise">
                  <p className="text-sm font-semibold text-primary">דלפק עיון ציבורי · בלתי מפלגתי</p>
                  <h1 className="mt-2 text-4xl font-extrabold leading-tight tracking-tight md:text-5xl">
                    מי מכהן בכנסת ובממשלה — ומה הנתונים באמת יכולים לומר
                  </h1>
                  <p className="mt-4 max-w-2xl text-lg text-muted-foreground">
                    מדריך פתוח לכל אזרח ואזרחית: חיפוש נבחרי ציבור ומשרדי ממשלה, לצד הסבר שקוף על המקור, התאריכים והפערים.
                  </p>
                  <div className="mt-6 flex flex-wrap gap-3">
                    <Link href="/directory" className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-3 font-semibold text-primary-foreground transition hover:gap-3" data-testid="link-cta-directory">
                      לחיפוש במדריך <ArrowLeft className="h-4 w-4" aria-hidden />
                    </Link>
                    <Link href="/sources" className="inline-flex items-center rounded-md border bg-card px-5 py-3 font-semibold text-primary hover:bg-secondary" data-testid="link-cta-sources">
                      איך נאספו הנתונים
                    </Link>
                  </div>
                </div>
                <IsraelFlag className="hidden w-56 rounded shadow-[0_20px_40px_-20px_hsl(218_88%_33%/0.45)] md:block" />
              </div>
            </section>

            <div className="mx-auto max-w-6xl space-y-10 px-4 py-10">
              <section aria-labelledby="h-counts" className="space-y-4">
                <h2 id="h-counts" className="text-2xl font-bold">מה יש בעותק</h2>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <Stat label="אנשים ייחודיים" value={sum.unique} hint="כל אדם נספר פעם אחת" testid="text-count-unique" />
                  <Stat label="מסומנים כחברי כנסת" value={sum.mk} hint="is_mk במקור" testid="text-count-mk" />
                  <Stat label="בעלי תפקידים בממשלה" value={sum.gov} hint="שרים וסגנים לפי is_government במקור" testid="text-count-gov" />
                  <Stat label="משרדי ממשלה" value={sum.ministries} hint="רשומות משרד בעותק" testid="text-count-ministries" />
                </div>
                <Note>
                  הקבוצות חופפות: {nf.format(sum.both)} אנשים מסומנים גם כחברי כנסת וגם כבעלי תפקידים בממשלה, ולכן סכום חברי הכנסת ובעלי התפקידים בממשלה
                  ({nf.format(sum.mk + sum.gov)}) אינו מספר האנשים הייחודיים ({nf.format(sum.unique)}).
                </Note>
              </section>

              <section aria-labelledby="h-dates" className="grid gap-4 lg:grid-cols-3">
                <h2 id="h-dates" className="sr-only">תאריכים ומקור</h2>
                <div className="rounded-xl border bg-card p-5">
                  <h3 className="font-bold">לפי דיווח המקור</h3>
                  <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
                    <dt className="text-muted-foreground">כנסת</dt><dd className="font-semibold">{s.knesset}</dd>
                    <dt className="text-muted-foreground">ממשלה</dt><dd className="font-semibold">{s.government}</dd>
                  </dl>
                  <p className="mt-3 text-xs text-muted-foreground">אלה מספרי הכנסת והממשלה שהמקור המשני דיווח עליהם — אין בכך אימות שזו הכנסת או הממשלה האחרונה.</p>
                </div>
                <div className="rounded-xl border bg-card p-5">
                  <h3 className="font-bold">חלון תצפית היסטורי</h3>
                  <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
                    <dt className="text-muted-foreground">התחלה</dt><dd><D v={s.activity.start} /></dd>
                    <dt className="text-muted-foreground">סיום</dt><dd><D v={s.activity.end} /></dd>
                    <dt className="text-muted-foreground">אירוע אחרון</dt><dd><D v={s.activity.latest_event_at} /></dd>
                  </dl>
                  <p className="mt-3 text-xs text-muted-foreground">פעילות הוועדות מתועדת רק עד התאריך הזה — מוקדם בהרבה ממועד האיסוף.</p>
                </div>
                <div className="rounded-xl border bg-card p-5">
                  <h3 className="font-bold">איסוף העותק</h3>
                  <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
                    <dt className="text-muted-foreground">נאסף</dt><dd><D v={s.fetched_at} time /></dd>
                    <dt className="text-muted-foreground">יובא למאגר</dt><dd><D v={s.imported_at} time /></dd>
                    <dt className="text-muted-foreground">סנכרון</dt><dd>{s.sync_active ? "פעיל" : "לא פעיל"}</dd>
                  </dl>
                  <p className="mt-3 text-xs text-muted-foreground">תזמון האיסוף פועל רק כשהשרת פועל. Last-Modified של כל קובץ מקור מופיע בעמוד המקורות.</p>
                </div>
              </section>

              <section aria-labelledby="h-limits" className="rounded-xl border bg-card p-6">
                <SyncStatus />
                <h2 id="h-limits" className="text-xl font-bold">מה העותק יכול — ומה לא</h2>
                <div className="mt-4 grid gap-6 md:grid-cols-2">
                  <div>
                    <h3 className="font-semibold text-primary">יכול להראות</h3>
                    <ul className="mt-2 list-disc space-y-1 pe-0 ps-5 text-sm">
                      <li>מי מופיע במקור כחבר/ת כנסת או כבעל/ת תפקיד בממשלה</li>
                      <li>תפקידים ותאריכי התחלה וסיום כפי שנרשמו</li>
                      <li>שיוך לוועדות ומספר ישיבות ועדה מתועדות בחלון היסטורי מוגדר</li>
                      <li>שיוך נושאי תפקיד למשרדי ממשלה</li>
                    </ul>
                  </div>
                  <div>
                    <h3 className="font-semibold text-primary">אינו יכול להראות</h3>
                    <ul className="mt-2 list-disc space-y-1 ps-5 text-sm">
                      <li>מינויים נוכחיים מאומתים או מצב בזמן אמת</li>
                      <li>הצבעות עדכניות, נוכחות חיה, שיעורי נוכחות</li>
                      <li>מנכ״לים, ראשי רשויות, ביצוע תקציב ותוצאות שירות</li>
                      <li>מגמות — יש תצפית אחת בלבד</li>
                      <li>דירוג, ציון או הערכת ביצועים של אדם או סיעה</li>
                    </ul>
                  </div>
                </div>
              </section>
            </div>
          </>
        );
      }}
    </SnapshotGate>
  );
}
