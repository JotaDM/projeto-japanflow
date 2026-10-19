import { Activity, AlertTriangle } from 'lucide-react';
import { useCostGuard } from '@/hooks/useCostGuard';
import { cn } from '@/lib/utils';

export function quotaColor(value: number) {
  return value >= 90 ? 'bg-red-500' : value >= 75 ? 'bg-amber-500' : 'bg-emerald-500';
}
export function QuotaProgress({ compact = false }: { compact?: boolean }) {
  const guard = useCostGuard(true);
  const value = Math.max(0, guard.maxPercentage);
  const unavailable = guard.status !== 'ready';
  return (
    <section
      className={cn(
        'rounded-2xl border border-border/70 bg-card shadow-card',
        compact ? 'p-3' : 'p-4 md:p-5'
      )}
      aria-label="Consumo diário do Firestore"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-sm font-semibold">
          <Activity className="h-4 w-4" /> Firestore · consumo diário
        </span>
        <span className="text-lg font-bold tabular-nums">
          {unavailable ? '—' : `${value.toFixed(1)}%`}
        </span>
      </div>
      <div
        role="progressbar"
        aria-label="Maior percentual da cota Firestore"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={unavailable ? undefined : Math.min(100, value)}
        className="mt-3 h-2.5 overflow-hidden rounded-full bg-muted"
      >
        <div
          className={cn('h-full rounded-full transition-all', quotaColor(value))}
          style={{ width: `${unavailable ? 0 : Math.min(100, value)}%` }}
        />
      </div>
      {!unavailable && (
        <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
          <span>Leituras: {guard.readsPercentage.toFixed(1)}%</span>
          <span>Gravações: {guard.writesPercentage.toFixed(1)}%</span>
          <span>Exclusões: {guard.deletesPercentage.toFixed(1)}%</span>
          <span>Estado: {guard.mode}</span>
        </div>
      )}
      {guard.status === 'ready' && guard.lastUpdated && (
        <p className="mt-2 text-xs text-muted-foreground">
          Atualizado: {guard.lastUpdated.toLocaleString('pt-BR')}
        </p>
      )}
      {unavailable && (
        <p className="mt-2 flex gap-1 text-xs text-amber-600">
          <AlertTriangle className="h-3.5 w-3.5" /> Monitoramento indisponível. O consumo real não
          pode ser confirmado.
        </p>
      )}
    </section>
  );
}
