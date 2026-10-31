import { type ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { getGetPublicSnapshotQueryKey, useGetPublicSnapshot, useGetMonitorSyncStatus, getGetMonitorSyncStatusQueryKey } from "@workspace/api-client-react";
import { RotateCw, ShieldAlert, Info } from "lucide-react";
import { fmtDate, safeUrl } from "@/lib/snapshot";

export function IsraelFlag({ className = "" }: { className?: string }) {
  // Proportions 160x220 (8:11). Stripes 25 units at 15 from edges; Star of David from two overlapping triangles.
  const cx = 110, cy = 80, r = 30;
  const tri = (up: boolean) =>
    [0, 1, 2]
      .map((i) => {
        const a = ((up ? -90 : 90) + i * 120) * (Math.PI / 180);
        return `${(cx + r * Math.cos(a)).toFixed(2)},${(cy + r * Math.sin(a)).toFixed(2)}`;
      })
      .join(" ");
  return (
    <svg viewBox="0 0 220 160" className={className} role="img" aria-label="דגל ישראל">
      <rect width="220" height="160" fill="#fff" />
      <rect y="15" width="220" height="25" fill="#0038b8" />
      <rect y="120" width="220" height="25" fill="#0038b8" />
      <g fill="none" stroke="#0038b8" strokeWidth="5.5">
        <polygon points={tri(true)} />
        <polygon points={tri(false)} />
      </g>
      <rect width="220" height="160" fill="none" stroke="hsl(215 32% 80%)" strokeWidth="2" />
    </svg>
  );
}

const NAV = [
  { href: "/", label: "סקירה" },
  { href: "/directory", label: "מדריך אנשים ומשרדים" },
  { href: "/analysis", label: "ניתוח כיסוי" },
  { href: "/sources", label: "מקורות ומתודולוגיה" },
];

export function ReloadButton() {
  const qc = useQueryClient();
  const q = useGetPublicSnapshot();
  return (
    <button
      type="button"
      data-testid="button-reload-snapshot"
      onClick={() => { void qc.refetchQueries({ queryKey: getGetPublicSnapshotQueryKey() }); void qc.refetchQueries({ queryKey: getGetMonitorSyncStatusQueryKey() }); }}
      disabled={q.isFetching}
      title="טוען שוב את העותק התקין האחרון השמור בשרת. אינו מפעיל איסוף מהמקורות החיצוניים."
      className="inline-flex items-center gap-2 rounded-md border border-primary/30 bg-card px-3 py-2 text-sm font-medium text-primary transition hover:bg-secondary active:scale-[.98] disabled:opacity-60"
    >
      <RotateCw className={`h-4 w-4 ${q.isFetching ? "animate-spin" : ""}`} aria-hidden />
      טעינה מחדש של העותק השמור
      <span className="sr-only">(אינו מסנכרן מול המקור החיצוני)</span>
    </button>
  );
}

export function CaveatBar() {
  const q = useGetPublicSnapshot();
  const status = useGetMonitorSyncStatus({ query: { queryKey: getGetMonitorSyncStatusQueryKey(), refetchInterval: 30_000 } });
  const s = q.data;
  return (
    <div className="border-b border-amber-300/60 bg-amber-50 text-amber-950" role="note" data-testid="banner-caveat">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2 text-sm">
        <ShieldAlert className="h-4 w-4 shrink-0" aria-hidden />
        <strong className="font-semibold">עותק נתונים שמור, לא אומת באופן עצמאי.</strong>
        <span>אין לראות בו רשימת מינויים נוכחית מאומתת.</span>
        {status.isError && <span role="status">מצב העדכון אינו זמין כרגע.</span>}
        {status.data?.last_error && <span role="status">העדכון האחרון לא הושלם; נשמר העותק התקין האחרון.</span>}
        {s && (
          <span className="text-amber-900/80">
            נאסף: <bdi>{fmtDate(s.fetched_at, true)}</bdi> · תזמון איסוף: {s.sync_active ? "יומי, כשהשרת פועל" : "לא פעיל"}
          </span>
        )}
        <Link href="/sources" className="font-semibold underline underline-offset-2" data-testid="link-caveat-sources">
          מה הנתונים אינם כוללים
        </Link>
      </div>
    </div>
  );
}

export function Shell({ children }: { children: ReactNode }) {
  const [loc] = useLocation();
  const q = useGetPublicSnapshot();
  const repo = safeUrl(q.data?.repository);
  return (
    <div className="flex min-h-[100dvh] flex-col">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:right-3 focus:top-3 focus:z-[100] focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
      >
        דילוג לתוכן הראשי
      </a>
      <CaveatBar />
      <header className="sticky top-0 z-40 border-b bg-card/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3">
          <Link href="/" className="flex items-center gap-3" data-testid="link-home">
            <IsraelFlag className="h-8 w-auto rounded-[2px]" />
            <span className="leading-tight">
              <span className="block text-lg font-extrabold tracking-tight text-primary">ישראל פרקטלית</span>
              <span className="block text-xs text-muted-foreground">דלפק עיון ציבורי · קריאה בלבד</span>
            </span>
          </Link>
          <nav aria-label="ניווט ראשי" className="order-3 w-full overflow-x-auto md:order-none md:w-auto md:flex-1">
            <ul className="flex gap-1">
              {NAV.map((n) => {
                const active = n.href === "/" ? loc === "/" : loc.startsWith(n.href);
                return (
                  <li key={n.href}>
                    <Link
                      href={n.href}
                      aria-current={active ? "page" : undefined}
                      data-testid={`link-nav-${n.href.replace("/", "") || "home"}`}
                      className={`relative block whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium transition ${
                        active ? "bg-secondary text-primary" : "text-foreground/80 hover:bg-muted hover:text-foreground"
                      }`}
                    >
                      {n.label}
                      {active && <span className="absolute inset-x-3 -bottom-[13px] hidden h-[3px] rounded-full bg-primary md:block" />}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
          <div className="ms-auto md:ms-0">
            <ReloadButton />
          </div>
        </div>
      </header>
      <main id="main" tabIndex={-1} className="flex-1 outline-none">
        {children}
      </main>
      <footer className="border-t bg-card">
        <div className="mx-auto grid max-w-6xl gap-4 px-4 py-6 text-sm text-muted-foreground md:grid-cols-[1fr_auto]">
          <div className="space-y-1">
            <p>
              ישראל פרקטלית היא כלי עיון בלתי מפלגתי. אין כאן דירוגים, המלצות או טענות בזמן אמת — רק מה שהמקור המתועד מראה, עם גבולותיו.
            </p>
            <p>אין חשבונות משתמש, אין אנליטיקה ואין מעקב.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Link href="/sources" className="font-medium text-primary underline-offset-2 hover:underline" data-testid="link-footer-sources">
              מקורות ומתודולוגיה
            </Link>
            {repo && (
              <a href={repo} target="_blank" rel="noopener noreferrer" className="font-medium text-primary underline-offset-2 hover:underline" data-testid="link-footer-repo">
                מאגר הקוד והנתונים
              </a>
            )}
          </div>
        </div>
      </footer>
    </div>
  );
}

export function PageHeader({ eyebrow, title, children }: { eyebrow: string; title: string; children?: ReactNode }) {
  return (
    <div className="civic-grid border-b bg-gradient-to-b from-secondary/60 to-background">
      <div className="mx-auto max-w-6xl px-4 pb-8 pt-10 rise">
        <p className="text-sm font-semibold tracking-wide text-primary">{eyebrow}</p>
        <h1 className="mt-1 text-3xl font-extrabold tracking-tight md:text-4xl">{title}</h1>
        {children && <div className="mt-3 max-w-3xl text-base text-muted-foreground">{children}</div>}
      </div>
    </div>
  );
}

export function Note({ children, tone = "info" }: { children: ReactNode; tone?: "info" | "warn" }) {
  return (
    <div
      role="note"
      className={`flex gap-2 rounded-lg border p-3 text-sm ${
        tone === "warn" ? "border-amber-300 bg-amber-50 text-amber-950" : "border-primary/20 bg-secondary/60 text-secondary-foreground"
      }`}
    >
      <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <div>{children}</div>
    </div>
  );
}

export function D({ v, time, fallback = "לא נרשם" }: { v: string | null | undefined; time?: boolean; fallback?: string }) {
  const f = fmtDate(v, time);
  return f ? <bdi>{f}</bdi> : <span className="text-muted-foreground">{fallback}</span>;
}
