import { CheckCircle2 } from 'lucide-react';
import { useDailyCompletedCount } from '@/hooks/useDailyCompletedCount';
interface Props { userId?: string; compact?: boolean; }
const DailyCompletedCounter = ({ userId, compact }: Props) => {
  const { count: completedToday, error } = useDailyCompletedCount(userId);
  if (compact)
    return (
      <div title={error || undefined} className="inline-flex h-10 items-center gap-2 rounded-xl border border-border/70 bg-card px-3 shadow-sm">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-success/10 text-success">
          <CheckCircle2 className="h-4 w-4" />
        </div>
        <div className="flex items-baseline gap-1.5">
          <span className="text-sm font-semibold">{completedToday ?? "—"}</span>
          <span className="text-[11px] text-muted-foreground">hoje</span>
        </div>
      </div>
    );

  return (
    <div title={error || undefined} className="jf-surface flex items-center gap-3 p-4">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-success/10 text-success">
        <CheckCircle2 className="h-5 w-5" />
      </div>
      <div>
        <p className="text-2xl font-semibold">{completedToday ?? "—"}</p>
        <p className="text-xs text-muted-foreground">Concluídas hoje</p>
      </div>
    </div>
  );
};

export default DailyCompletedCounter;
