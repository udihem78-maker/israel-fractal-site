import { ExternalLink } from "lucide-react";
import { SnapshotGate } from "@/components/gate";
import { D, Note, PageHeader } from "@/components/shell";
import { coverageLabels, coverageStatus, nf, safeUrl, sourceLabels } from "@/lib/snapshot";
import { SyncStatus } from "@/components/sync-status";

function L({ href, children, testid }: { href: string | null; children: React.ReactNode; testid: string }) {
  if (!href) return <span className="text-muted-foreground">קישור אינו זמין</span>;
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" data-testid={testid} className="inline-flex items-center gap-1 break-all font-medium text-primary hover:underline">
      {children}<ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden /><span className="sr-only">(נפתח בלשונית חדשה)</span>
    </a>
  );
}

export default function Sources() {
  return (
    <SnapshotGate>
      {(s) => {
        const repo = safeUrl(s.repository);
        const rev = repo && s.revision ? safeUrl(`${repo.replace(/\/$/, "")}/tree/${encodeURIComponent(s.revision)}`) : null;
        return (
          <>
            <PageHeader eyebrow="שקיפות" title="מקורות ומתודולוגיה">
              כל מספר נגזר מהאיסוף התקין האחרון. כאן מפורט מאין הגיע, מתי, כיצד הוא מתעדכן ומה חסר בו.
            </PageHeader>
            <div className="mx-auto max-w-6xl space-y-8 px-4 py-8">
              <SyncStatus />
              <section aria-labelledby="h-files" className="space-y-3">
                <h2 id="h-files" className="text-xl font-bold">קבצי מקור</h2>
                <p className="text-sm text-muted-foreground">אזהרות העדכניות לכל קובץ מופיעות למעלה. Last-Modified הוא תאריך שינוי הקובץ כפי שדווח בשרת, ולא תאריך הפעילות שבתוכו.</p>
                <ul className="grid gap-3 md:grid-cols-2">
                  {Object.entries(s.sources ?? {}).map(([k, src]) => (
                    <li key={k} className="space-y-2 rounded-xl border bg-card p-4 text-sm">
                      <h3 className="font-bold">{sourceLabels[k] ?? k}</h3>
                      <L href={safeUrl(src.url)} testid={`link-source-${k}`}><bdi>{src.url}</bdi></L>
                      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
                        <dt className="text-muted-foreground">Last-Modified</dt><dd><D v={src.last_modified} time fallback="לא דווח" /></dd>
                        <dt className="text-muted-foreground">גודל</dt><dd><bdi>{nf.format(src.bytes)}</bdi> בתים</dd>
                        <dt className="text-muted-foreground">SHA-256</dt><dd className="hash text-xs">{src.sha256}</dd>
                      </dl>
                    </li>
                  ))}
                </ul>
              </section>

              <section aria-labelledby="h-repo" className="space-y-3 rounded-xl border bg-card p-5 text-sm">
                <h2 id="h-repo" className="text-xl font-bold">מקור העותק וייחוס</h2>
                <dl className="grid gap-x-4 gap-y-2 sm:grid-cols-[auto_1fr]">
                  <dt className="text-muted-foreground">מקור הנתונים המוצגים</dt><dd>{s.dataset_origin === "direct_collection" ? "איסוף ישיר של קובצי כנסת פתוחה — לא מתוך המאגר המקורי" : "עותק מוצמד מהמאגר המקורי; טרם הוחלף באיסוף ישיר"}</dd>
                  <dt className="text-muted-foreground">מאגר</dt><dd><L href={repo} testid="link-repo"><bdi>{s.repository}</bdi></L></dd>
                  <dt className="text-muted-foreground">גרסת הבסיס המקורית (לייחוס בלבד)</dt><dd>{rev ? <L href={rev} testid="link-revision"><span className="hash">{s.revision}</span></L> : <span className="hash">{s.revision}</span>}</dd>
                  <dt className="text-muted-foreground">SHA-256 נתוני העותק</dt><dd className="hash text-xs">{s.snapshot_sha256}</dd>
                  <dt className="text-muted-foreground">SHA-256 היסטוריית האיסוף</dt><dd className="hash text-xs">{s.history_sha256}</dd>
                  <dt className="text-muted-foreground">נאסף מהמקור (fetched_at)</dt><dd><D v={s.fetched_at} time /></dd>
                  <dt className="text-muted-foreground">יובא לאפליקציה (imported_at)</dt><dd><D v={s.imported_at} time /></dd>
                  <dt className="text-muted-foreground">תזמון אוטומטי</dt><dd>{s.sync_active ? "מופעל בשרת האפליקציה הזו בלבד; ראו מצב המשיכה למעלה" : "לא פעיל"}</dd>
                </dl>
              </section>

              <section aria-labelledby="h-method" className="space-y-3 rounded-xl border bg-card p-5">
                <h2 id="h-method" className="text-xl font-bold">מתודולוגיה ומעמד המקור</h2>
                <ul className="list-disc space-y-2 ps-5 text-sm">
                  <li><strong>מקור משני:</strong> הנתונים הם עותק של Open Knesset (כנסת פתוחה), לא שליפה ישירה מאתר הכנסת הרשמי. מצב הרשימה: <bdi className="hash">{s.roster_status}</bdi>.</li>
                  <li><strong>מקור ראשי:</strong> ניסיון קודם לשליפה ישירה מהכנסת החזיר דף HTML של חסימה גאוגרפית למרות קוד HTTP 200. הדבר לא נבדק מחדש כעת.</li>
                  <li>מספרי הכנסת ({s.knesset}) והממשלה ({s.government}) הם כפי שדווחו במקור, ואינם מוכיחים שאלה הכנסת או הממשלה האחרונות.</li>
                  <li>ישיבות ועדה מתועדות נספרות לפי צמדי מזהה ועדה ותאריך תחילת ישיבה ייחודיים שבהם האדם מתועד, בחלון <D v={s.activity.start} />–<D v={s.activity.end} /> (אירוע אחרון: <D v={s.activity.latest_event_at} />). אין זה שיעור נוכחות או הבטחת שלמות.</li>
                  <li>{s.dataset_origin === "direct_collection" ? "קובצי CSV הורדו באפליקציה הזו ונבדקו באמצעות סכמת העמודות, שדות חובה, תאריכים וקשרים בין רשומות. גיבובי SHA-256 חושבו מהבתים שהתקבלו; Last-Modified הוא דיווח שרת המקור, לא תאריך האירוע. גיבובי העותק וההיסטוריה חושבו מ־JSON מנורמל. אלה בדיקות תקינות טכנית, לא אימות עצמאי של התוכן." : "גיבובי קובצי JSON נבדקו מול העותק המוצמד. גיבובי CSV ו־Last-Modified בעותק זה דווחו בידי האוסף המקורי. הגיבובים המוצגים לעותק ולהיסטוריה מחושבים מ־JSON מנורמל עם סדר מפתחות קבוע, ונבדקים מחדש בכל קריאה מהמסד."}</li>
                  <li>הנתונים והיסטוריית האיסוף נשמרים במסד הנתונים רק לאחר הצלחת כל הבדיקות. בכשל מוצג העותק התקין האחרון עם הודעת מצב; לא מחליפים נתונים חסרים באפסים.</li>
                  <li>ריבוי איסופים אינו מעיד כשלעצמו על פעילות חדשה. זהו מדריך ולוח תצפיות מתוארכות — לא הערכה רציפה ומלאה של מוסדות הציבור.</li>
                  <li>אין ציונים מורכבים, דירוגים, המלצות, עמדה מפלגתית או טענות בזמן אמת.</li>
                </ul>
              </section>

              <section aria-labelledby="h-cov" className="space-y-3">
                <h2 id="h-cov" className="text-xl font-bold">מה אינו מחובר</h2>
                <ul className="grid gap-2 sm:grid-cols-2">
                  {Object.entries(s.coverage ?? {}).map(([k, v]) => (
                    <li key={k} className="flex items-center justify-between gap-3 rounded-lg border bg-card px-4 py-3 text-sm">
                      <span className="font-medium">{coverageLabels[k] ?? k}</span>
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900">{coverageStatus[v] ?? v}</span>
                    </li>
                  ))}
                </ul>
                <Note>הכפתור &quot;טעינה מחדש של העותק השמור&quot; טוען שוב את הנתונים שנשמרו לאחר האיסוף התקין האחרון — הוא אינו מפעיל משיכה מול המקורות החיצוניים.</Note>
              </section>
            </div>
          </>
        );
      }}
    </SnapshotGate>
  );
}
