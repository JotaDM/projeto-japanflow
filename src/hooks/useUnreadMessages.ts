import { useChatUnreadCounts } from '@/hooks/useChatUnreadCounts';
/** Total privado exato calculado no backend; não consulta histórico. */
export function useUnreadMessages(userId: string | null) {
  const { privateTotal, error, loading } = useChatUnreadCounts(userId);
  return { totalUnread: privateTotal, error, loading };
}
