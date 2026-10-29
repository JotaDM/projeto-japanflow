import type { User } from '@/types';

/** Destinatária explicitamente liberada para receber tarefas de toda a equipe. */
export function isCarolRecipient(user: User): boolean {
  return (
    user.active !== false &&
    user.role === 'employee' &&
    (user.username || '').trim().toLowerCase().replace(/_+$/, '') === 'carol'
  );
}
