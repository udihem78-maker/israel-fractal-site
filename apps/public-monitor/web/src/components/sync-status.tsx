import { useGetMonitorSyncStatus, getGetMonitorSyncStatusQueryKey, getGetPublicSnapshotQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { D } from "./shell";
import { ContentFreshnessNotice } from "./content-freshness";

export function SyncStatus() {
  const query = useGetMonitorSyncStatus({ query: { queryKey: getGetMonitorSyncStatusQueryKey(), refetchInterval: 30_000, staleTime: 0 } });
  const qc = useQueryClient();
  const success = query.data?.last_success;
  useEffect(() => {
    if (success) void qc.invalidateQueries({ queryKey: getGetPublicSnapshotQueryKey() });
  }, [success, qc]);
  const s = query.data;
  return (
    <section aria-labelledby="sync-title" className="space-y-3 rounded-xl border border-primary/25 bg-card p-5" data-testid="sync-status">
      <h2 id="sync-title" className="text-xl font-bold">עדכון מהמקורות</h2>
      {query.isError ? <p role="alert">לא ניתן לברר כרגע את מצב האיסוף. אין להסיק שהנתונים מעודכנים.</p> :
        !s ? <p role="status">בודק את מצב העדכון…</p> : <>
          <p role="status" className="font-medium">
            {s.running ? "מתבצעת משיכה ואימות של קובצי המקור; העותק הקודם מוצג עד להשלמה." :
              s.last_error ? "העדכון האחרון לא הושלם — העותק התקין האחרון נשמר." :
              s.last_success ? "המשיכה האחרונה הושלמה ועברה בדיקות תקינות." : "טרם הושלם איסוף ישיר; מוצג העותק המקורי."}
          </p>
          <dl className="grid gap-x-4 gap-y-2 text-sm sm:grid-cols-[auto_1fr]">
            <dt className="text-muted-foreground">תזמון</dt><dd>{s.enabled ? `אחת ל־${s.interval_hours} שעות, כל עוד השרת פועל` : "אינו פעיל"}</dd>
            <dt className="text-muted-foreground">ניסיון אחרון</dt><dd><D v={s.last_attempt} time fallback="טרם בוצע" /></dd>
            <dt className="text-muted-foreground">הצלחה אחרונה</dt><dd><D v={s.last_success} time fallback="טרם נרשמה" /></dd>
            <dt className="text-muted-foreground">ניסיון הבא</dt><dd>{s.running ? "ייקבע בסיום האיסוף" : <D v={s.next_attempt} time fallback="בהפעלת השרת" />}</dd>
          </dl>
          {s.last_error && <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-950">{s.last_error}</p>}
          <p className="text-sm text-muted-foreground">
            חמישה קבצים ציבוריים מכנסת פתוחה: אנשים, שיוכי תפקידים, סוגי תפקידים, משרדים ותצפיות ועדות.
            בכשל, ניסיון נוסף אחרי כשעה. עד 90 ימי איסוף נשמרים, רשומה אחת לכל יום איסוף ב־UTC.
            עצירת השרת משהה את העדכונים; בהפעלתו נבדק אם הגיע מועד האיסוף הבא.
          </p>
        </>}
      <p className="text-sm text-muted-foreground">איסוף חדש אינו הוכחה למינוי חדש או לפעילות חדשה. תאריכי האירועים ומעמד המקור המשני נשארים נפרדים. בדיקת המצב בדפדפן אינה מפעילה משיכה מהמקורות.</p>
      {s?.freshness && <ContentFreshnessNotice freshness={s.freshness} />}
    </section>
  );
}
