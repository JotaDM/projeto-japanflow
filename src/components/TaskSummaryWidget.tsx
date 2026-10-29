import { CheckCircle2, Clock3, ListTodo, PauseCircle } from 'lucide-react';
import type { Task } from '@/types';

/** Uses only tasks already accessible to the board; no additional Firestore reads. */
export default function TaskSummaryWidget({ tasks }: { tasks: Task[] }) {
  const active = tasks.filter((task) => !('archivedAt' in task && task.archivedAt));
  const values = [
    {
      label: 'A fazer',
      count: active.filter((task) => task.status === 'todo').length,
      Icon: ListTodo,
    },
    {
      label: 'Em andamento',
      count: active.filter((task) => task.status === 'in_progress').length,
      Icon: Clock3,
    },
    {
      label: 'Pausadas',
      count: active.filter((task) => task.status === 'paused').length,
      Icon: PauseCircle,
    },
    {
      label: 'Concluídas',
      count: active.filter((task) => task.status === 'done').length,
      Icon: CheckCircle2,
    },
  ];
  return (
    <section
      className="min-w-0 rounded-2xl border bg-card p-4 shadow-sm"
      aria-label="Resumo das tarefas"
    >
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-semibold">Resumo das tarefas</h2>
        <span className="text-xs text-muted-foreground">
          {active.length} tarefas não arquivadas
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {values.map(({ label, count, Icon }) => (
          <div key={label} className="min-w-0 rounded-xl bg-muted/60 p-3">
            <Icon className="mb-2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
            <strong className="block text-xl tabular-nums">{count}</strong>
            <span className="text-xs text-muted-foreground">{label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
