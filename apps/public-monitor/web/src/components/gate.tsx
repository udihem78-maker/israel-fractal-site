import { type ReactNode } from "react";
import type { PublicSnapshot } from "@workspace/api-client-react";
import { useGetPublicSnapshot } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { ReloadButton } from "@/components/shell";
import { DatabaseZap } from "lucide-react";

export function SnapshotGate({ children }: { children: (s: PublicSnapshot) => ReactNode }) {
  const q = useGetPublicSnapshot();
  if (q.isLoading) {
    return (
      <div className="mx-auto max-w-6xl space-y-4 px-4 py-10" aria-busy="true" aria-live="polite">
        <span className="sr-only">טוען את העותק השמור…</span>
        <Skeleton className="h-10 w-2/3" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-28" />)}
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  if (q.isError || !q.data) {
    const msg = q.error instanceof Error ? q.error.message : null;
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center" role="alert" data-testid="status-snapshot-error">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-secondary text-primary">
          <DatabaseZap className="h-7 w-7" aria-hidden />
        </div>
        <h1 className="text-2xl font-bold">העותק השמור אינו זמין כרגע</h1>
        <p className="mt-2 text-muted-foreground">
          לא הצלחנו לטעון את קובץ הנתונים מהשרת. לא מוצגים נתונים חלופיים או לדוגמה.
        </p>
        {msg && <p className="mt-2 hash text-xs text-muted-foreground">{msg}</p>}
        <div className="mt-6 flex justify-center"><ReloadButton /></div>
      </div>
    );
  }
  return <>{children(q.data)}</>;
}
