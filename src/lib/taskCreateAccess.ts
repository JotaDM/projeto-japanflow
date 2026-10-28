import type { User } from '@/types';

// ExceÃ§Ãµes operacionais aprovadas para criaÃ§Ã£o de tarefas.
// O acesso permanente por funÃ§Ã£o/setor deve ser consolidado no QA de permissÃµes.
const authorizedUsernames = new Set(['joe', 'wagner', 'ana', 'jean', 'carol', 'julio']);

export function canCreateTasksForAll(user: User | null | undefined): boolean {
  if (!user || user.active === false) return false;
  if (user.role === 'admin' || user.sectors?.includes('vendas')) return true;

  // Perfis migrados/recriados podem ter recebido sufixo "_" no username.
  const normalized = (user.username || '').trim().toLowerCase().replace(/_+$/, '');
  return authorizedUsernames.has(normalized);
}
