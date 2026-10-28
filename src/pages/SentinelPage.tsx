import { Link, Navigate } from 'react-router-dom';
import { Activity, AlertTriangle, ArrowUpRight, CheckCircle2, ShieldAlert } from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
import { useCostGuard } from '@/hooks/useCostGuard';

/** Sentinel 0.1: observabilidade passiva, sem privilégios de gravação. */
export default function SentinelPage() {
  const { currentUser, authenticatedUser } = useApp();
  const authorized =
    currentUser?.role === 'admin' ||
    authenticatedUser?.username?.trim().toLowerCase() === 'japan-ti' ||
    (authenticatedUser?.sectors as string[] | undefined)?.includes('ti');
  const guard = useCostGuard(Boolean(authorized));
  if (!currentUser) return <Navigate to="/login" replace />;
  if (!authorized)
    return (
      <div role="alert" className="rounded-xl border p-6">
        Acesso restrito à administração e TI.
      </div>
    );
  const unavailable = guard.status !== 'ready';
  const concerning = guard.mode !== 'normal' || guard.maxPercentage >= 75;
  return (
    <div className="space-y-5">
      <header className="rounded-2xl border bg-card p-6">
        <div className="flex items-center gap-3">
          <ShieldAlert className="h-8 w-8 text-primary" />
          <div>
            <p className="text-xs uppercase tracking-widest text-muted-foreground">
              JapanFlow Sentinel · 0.1
            </p>
            <h1 className="text-2xl font-semibold">Centro de observabilidade</h1>
          </div>
        </div>
        <p className="mt-3 text-sm text-muted-foreground">
          Monitoramento passivo com base no Cost Guard já publicado. Sem execução automática de
          ações administrativas.
        </p>
      </header>
      <section className="grid gap-3 md:grid-cols-3">
        <div className="rounded-2xl border bg-card p-5">
          <p className="text-xs text-muted-foreground">Telemetria</p>
          <div className="mt-2 flex items-center gap-2 text-lg font-semibold">
            {unavailable ? (
              <AlertTriangle className="text-amber-500" />
            ) : (
              <CheckCircle2 className="text-emerald-500" />
            )}
            {guard.status === 'loading' ? 'Carregando' : unavailable ? 'Indisponível' : 'Conectada'}
          </div>
        </div>
        <div className="rounded-2xl border bg-card p-5">
          <p className="text-xs text-muted-foreground">Modo do Cost Guard</p>
          <div className="mt-2 flex items-center gap-2 text-lg font-semibold">
            <Activity className="h-5 w-5" />
            {unavailable ? 'Não confirmado' : guard.mode}
          </div>
        </div>
        <div className="rounded-2xl border bg-card p-5">
          <p className="text-xs text-muted-foreground">Maior utilização reportada</p>
          <strong className="mt-2 block text-2xl tabular-nums">
            {unavailable ? '—' : `${guard.maxPercentage.toFixed(1)}%`}
          </strong>
        </div>
      </section>
      <section className="rounded-2xl border bg-card p-5" aria-live="polite">
        <h2 className="font-semibold">Estado da operação</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {unavailable
            ? 'Não foi possível confirmar o estado do monitor. Verifique o documento system_runtime/firestore_guard e suas permissões.'
            : concerning
              ? 'Atenção: o Cost Guard reportou modo de economia/proteção ou utilização elevada.'
              : 'O Cost Guard reporta modo normal. Isso não garante que todos os serviços estejam saudáveis.'}
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          Última atualização:{' '}
          {guard.lastUpdated ? guard.lastUpdated.toLocaleString('pt-BR') : 'não informada'}
        </p>
      </section>
      <Link
        to="/gas"
        className="inline-flex items-center gap-2 rounded-xl border bg-card px-4 py-2 text-sm font-medium hover:bg-muted"
      >
        Abrir diagnóstico detalhado (GAS) <ArrowUpRight className="h-4 w-4" />
      </Link>
    </div>
  );
}
