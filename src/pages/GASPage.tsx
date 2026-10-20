import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { collection, documentId, getDocs, limit, orderBy, query } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Activity, ArrowUpRight, Cloud, Database, ShieldCheck, AlertTriangle } from 'lucide-react';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  LineChart,
  Line,
  Legend,
} from 'recharts';
import { useApp } from '@/contexts/AppContext';
import { useCostGuard } from '@/hooks/useCostGuard';
import { quotaColor } from '@/components/QuotaProgress';
import { cn } from '@/lib/utils';

type DailyMetric = { day: string; reads: number; writes: number; deletes: number };
const numeric = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
};
const percent = (v: number) => `${Math.max(0, v).toFixed(1)}%`;
const barFill = (v: number) => (v >= 90 ? '#ef4444' : v >= 75 ? '#f59e0b' : '#10b981');
function MetricCard({ name, value }: { name: string; value: number }) {
  return (
    <section className="rounded-2xl border border-border/70 bg-card p-5 shadow-card">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-muted-foreground">{name}</p>
        <strong className="text-xl tabular-nums">{percent(value)}</strong>
      </div>
      <div
        role="progressbar"
        aria-label={`Uso de ${name}`}
        aria-valuenow={Math.min(100, Math.max(0, value))}
        aria-valuemin={0}
        aria-valuemax={100}
        className="mt-4 h-2.5 overflow-hidden rounded-full bg-muted"
      >
        <div
          className={cn('h-full rounded-full transition-all', quotaColor(value))}
          style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
        />
      </div>
      {value >= 100 && (
        <p className="mt-2 text-xs text-destructive">
          Limite de referência atingido ou ultrapassado.
        </p>
      )}
    </section>
  );
}
export default function GASPage() {
  const { authenticatedUser, isActingAsTi } = useApp();
  const isTi = Boolean(
    authenticatedUser?.username?.trim().toLowerCase() === 'japan-ti' ||
    authenticatedUser?.username?.trim().toLowerCase() === 'joe_' ||
    authenticatedUser?.username?.trim().toLowerCase() === 'ryan' ||
    (authenticatedUser?.sectors as string[] | undefined)?.includes('ti') ||
    isActingAsTi
  );
  const guard = useCostGuard(isTi);
  const [history, setHistory] = useState<DailyMetric[]>([]);
  const [historyStatus, setHistoryStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  useEffect(() => {
    if (!isTi) return;
    let cancelled = false;
    const load = async () => {
      try {
        const snapshot = await getDocs(
          query(collection(db, 'system_usage_daily'), orderBy(documentId(), 'desc'), limit(14))
        );
        if (cancelled) return;
        setHistory(
          snapshot.docs
            .map((item) => {
              const data = item.data();
              return {
                day: item.id,
                reads: numeric(data.reads_percentage),
                writes: numeric(data.writes_percentage),
                deletes: numeric(data.deletes_percentage),
              };
            })
            .reverse()
        );
        setHistoryStatus('ready');
      } catch (error) {
        if (cancelled) return;
        console.warn('Histórico de consumo indisponível:', error);
        setHistoryStatus('error');
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [isTi]);

  if (!isTi)
    return <div className="p-8 text-sm text-muted-foreground">Acesso restrito à equipe TI.</div>;
  const metrics = [
    { name: 'Leituras', value: Math.max(0, guard.readsPercentage) },
    { name: 'Gravações', value: Math.max(0, guard.writesPercentage) },
    { name: 'Exclusões', value: Math.max(0, guard.deletesPercentage) },
  ];
  const peak = Math.max(...metrics.map((m) => m.value), guard.maxPercentage);
  return (
    <main className="mx-auto w-full max-w-7xl space-y-6 p-1 md:p-4">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[.12em] text-muted-foreground">
            <Activity className="h-4 w-4" /> Gestão e Análise do Sistema
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">
            GAS <span className="text-muted-foreground">/ JapanFlow</span>
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Monitoramento operacional · métricas do Cost Guard
          </p>
        </div>
        <Link
          className="rounded-xl border border-border px-4 py-2 text-sm hover:bg-muted"
          to="/board"
        >
          Voltar ao quadro
        </Link>
      </header>
      {guard.status !== 'ready' && (
        <div
          role="status"
          className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-300"
        >
          {guard.status === 'loading'
            ? 'Carregando monitoramento do Firestore…'
            : 'Monitoramento indisponível: os percentuais podem não refletir o consumo atual.'}
        </div>
      )}
      {guard.status === 'ready' && guard.lastUpdated && (
        <p className="text-xs text-muted-foreground">
          Última amostra: {guard.lastUpdated.toLocaleString('pt-BR')} · Dia de referência:{' '}
          {guard.day || 'não informado'} (Pacífico)
        </p>
      )}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <section className="rounded-2xl border border-border/70 bg-card p-5 shadow-card">
          <p className="text-sm text-muted-foreground">Estado do Cost Guard</p>
          <p className="mt-2 text-2xl font-bold capitalize">{guard.mode}</p>
          <p className="mt-2 text-xs text-muted-foreground">
            Informação recebida de system_runtime/firestore_guard
          </p>
        </section>
        <MetricCard name="Maior consumo" value={peak} />
        <MetricCard name="Leituras" value={guard.readsPercentage} />
        <MetricCard name="Gravações" value={guard.writesPercentage} />
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <section className="min-w-0 rounded-2xl border border-border/70 bg-card p-5 shadow-card">
          <div className="mb-4">
            <h2 className="text-base font-semibold">Uso por operação</h2>
            <p className="text-xs text-muted-foreground">
              Percentual da respectiva quota diária, não volume absoluto.
            </p>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={metrics} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="hsl(var(--border))" />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                />
                <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} unit="%" />
                <Tooltip formatter={(value) => `${Number(value).toFixed(1)}%`} />
                <Bar dataKey="value" name="Utilizado" radius={[6, 6, 0, 0]}>
                  {metrics.map((item) => (
                    <Cell key={item.name} fill={barFill(item.value)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
        <section className="min-w-0 rounded-2xl border border-border/70 bg-card p-5 shadow-card">
          <h2 className="text-base font-semibold">Cota consumida / disponível</h2>
          <p className="mb-3 text-xs text-muted-foreground">Comparação individual por operação.</p>
          <div className="grid grid-cols-3 gap-1">
            {metrics.map((item) => {
              const used = Math.min(100, item.value);
              return (
                <div key={item.name} className="text-center">
                  <div className="h-40 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={[
                            { name: 'Usado', value: used },
                            { name: 'Disponível', value: Math.max(0, 100 - used) },
                          ]}
                          dataKey="value"
                          innerRadius="55%"
                          outerRadius="82%"
                          paddingAngle={used > 0 && used < 100 ? 1 : 0}
                          stroke="none"
                        >
                          <Cell fill={barFill(item.value)} />
                          <Cell fill="hsl(var(--muted))" />
                        </Pie>
                        <Tooltip formatter={(value) => `${Number(value).toFixed(1)}%`} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <p className="text-xs text-muted-foreground">{item.name}</p>
                  <p className="text-sm font-semibold">{percent(item.value)}</p>
                </div>
              );
            })}
          </div>
        </section>
      </div>
      <section className="grid gap-3 sm:grid-cols-2">
        <MetricCard name="Exclusões" value={guard.deletesPercentage} />
        <div className="rounded-2xl border border-border/70 bg-card p-5">
          <h2 className="flex items-center gap-2 text-base font-semibold">
            <ShieldCheck className="h-4 w-4" /> Leitura dos indicadores
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            As cores indicam faixas: verde abaixo de 75%, amarelo de 75% a 89,9% e vermelho a partir
            de 90%. Acima de 100% o valor permanece explícito.
          </p>
          <p className="mt-2 flex items-center gap-2 text-xs text-amber-600">
            <AlertTriangle className="h-4 w-4" /> Dados ausentes ou atrasados podem não refletir o
            consumo real.
          </p>
        </div>
      </section>
      <section className="rounded-2xl border border-border/70 bg-card p-5">
        <h2 className="text-base font-semibold">Acessos administrativos</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          <a
            href="https://console.firebase.google.com/u/1/project/japanflow-erp/firestore"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm hover:bg-muted"
          >
            <Database className="h-4 w-4" /> Firestore <ArrowUpRight className="h-3 w-3" />
          </a>
          <a
            href="https://console.cloud.google.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm hover:bg-muted"
          >
            <Cloud className="h-4 w-4" /> Google Cloud <ArrowUpRight className="h-3 w-3" />
          </a>
        </div>
      </section>
      <section className="rounded-2xl border border-border/70 bg-card p-5 shadow-card">
        <h2 className="text-base font-semibold">Evolução diária do Firestore</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Últimos 14 dias registrados pelo monitor, na janela diária do Pacífico. Cada ponto mostra
          o percentual medido no último monitoramento daquele dia.
        </p>
        {historyStatus === 'loading' ? (
          <p className="mt-4 text-sm text-muted-foreground">Carregando histórico…</p>
        ) : historyStatus === 'error' ? (
          <p className="mt-4 text-sm text-amber-600">
            Não foi possível consultar o histórico. Verifique as regras Firestore e a permissão TI.
          </p>
        ) : history.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">
            Ainda não há amostras históricas. Elas serão criadas quando o monitor de cotas executar
            após o deploy do backend.
          </p>
        ) : (
          <div className="mt-4 h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={history} margin={{ top: 10, right: 15, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="hsl(var(--border))" />
                <XAxis
                  dataKey="day"
                  tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                />
                <YAxis unit="%" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                <Tooltip formatter={(value) => `${Number(value).toFixed(1)}%`} />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="reads"
                  name="Leituras"
                  stroke="#10b981"
                  strokeWidth={2}
                  dot={history.length <= 7}
                />
                <Line
                  type="monotone"
                  dataKey="writes"
                  name="Gravações"
                  stroke="#f59e0b"
                  strokeWidth={2}
                  dot={history.length <= 7}
                />
                <Line
                  type="monotone"
                  dataKey="deletes"
                  name="Exclusões"
                  stroke="#ef4444"
                  strokeWidth={2}
                  dot={history.length <= 7}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>
      <p className="text-xs text-muted-foreground">
        Dados de Hosting e Storage exigem integração separada com o Cloud Monitoring. Os gráficos de
        evolução acima usam apenas amostras reais do Firestore.
      </p>
    </main>
  );
}
