import { Link } from 'react-router-dom';
import { UserRound, ListTodo, MessageSquare } from 'lucide-react';

/** Internal routes only, with normal app access checks preserved. */
export default function QuickLinksWidget() {
  const links = [
    { to: '/chat', label: 'Chat', Icon: MessageSquare },
    { to: '/board', label: 'Tarefas', Icon: ListTodo },
    { to: '/profile', label: 'Meu perfil', Icon: UserRound },
  ];
  return (
    <section
      className="min-w-0 rounded-2xl border bg-card p-4 shadow-sm"
      aria-label="Atalhos do workspace"
    >
      <h2 className="mb-3 font-semibold">Atalhos</h2>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {links.map(({ to, label, Icon }) => (
          <Link
            key={to}
            to={to}
            className="flex min-w-0 items-center gap-2 rounded-xl border px-3 py-3 text-sm font-medium transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
            {label}
          </Link>
        ))}
      </div>
    </section>
  );
}
