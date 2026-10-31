import type { ContentFreshness, FreshnessSignal } from "@workspace/api-client-react";
import { sourceLabels } from "@/lib/snapshot";
import { D } from "./shell";

function Signal({ signal, activity }: { signal: FreshnessSignal; activity: boolean }) {
  const label = activity ? "פעילות" : "שינוי קובץ HTTP";
  return <p className={signal.status === "stale" ? "font-medium text-amber-950" : ""}>
    {label}: {signal.status === "unknown"
      ? "לא ידוע — אין תאריך תקף זמין; אין להסיק עדכניות או היעדר פעילות."
      : <>
        {signal.status === "stale" ? "אזהרה — התאריך ישן" : "התאריך בתוך סף האזהרה"}
        {" "}(<D v={signal.date} />, לפני {signal.age_days} ימים; סף: {signal.threshold_days} ימים).
      </>}
  </p>;
}

export function ContentFreshnessNotice({ freshness }: { freshness: ContentFreshness }) {
  return <section aria-labelledby="freshness-title" className="space-y-3 border-t pt-4" data-testid="content-freshness">
    <h3 id="freshness-title" className="text-lg font-bold">עדכניות התוכן — בנפרד מהצלחת האיסוף</h3>
    <p className="text-sm">
      אזהרת פעילות מוצגת לאחר יותר מ־30 ימים מתאריך האירוע האחרון; אזהרת Last-Modified לאחר יותר מ־7 ימים משינוי הקובץ.
      אלה ספים מקומיים לפי ימים קלנדריים ב־UTC, לא התחייבות של המקור ולא דירוג ביצועים.
      שינוי קובץ אינו מעיד על אירוע חדש. תאריך חסר, לא תקין או עתידי מסומן כלא ידוע, לא כאפס ולא כישן.
    </p>
    <p className="text-sm text-muted-foreground">
      בדיקה: <D v={freshness.evaluated_at} time /> · איסוף העותק שנבדק: <D v={freshness.snapshot_fetched_at} time />.
      תאריך פעילות מופק כעת רק מתצפיות הוועדות; במקורות האחרים אין תאריך אירוע שניתן להעריך.
    </p>
    <ul className="grid gap-3 lg:grid-cols-2">
      {freshness.sources.map((source) => <li key={source.key}
        data-testid={`freshness-${source.key}`}
        className={`space-y-1 rounded-lg border p-3 text-sm ${source.activity.status === "stale" || source.http_modified.status === "stale" ? "border-amber-300 bg-amber-50 text-amber-950" : "bg-muted/30"}`}>
        <h4 className="font-bold">{sourceLabels[source.key] ?? source.key}</h4>
        <Signal signal={source.activity} activity />
        <Signal signal={source.http_modified} activity={false} />
      </li>)}
    </ul>
    <p className="text-sm text-muted-foreground">המידע מתאר את כיסוי המקור בלבד, לא היעדר פעילות של אדם, שיעור נוכחות או איכות ביצועיו.</p>
  </section>;
}
