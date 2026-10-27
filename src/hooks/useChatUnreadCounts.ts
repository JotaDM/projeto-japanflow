import { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchChatCounts, type ChatCountsResponse } from '@/lib/chatCountersClient';

const EMPTY: ChatCountsResponse = { privateTotal: 0, privateByPartner: {}, groupById: {} };
const BATCH = 20;

/** Contagens do backend, sem depender da janela de mensagens exibidas. */
export function useChatUnreadCounts(
  userId: string | null | undefined,
  partnerIds: string[] = [],
  groupIds: string[] = []
) {
  const partnersKey = [...new Set(partnerIds.filter(Boolean))].sort().join('|');
  const groupsKey = [...new Set(groupIds.filter(Boolean))].sort().join('|');
  const [counts, setCounts] = useState<ChatCountsResponse>(EMPTY);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const refresh = useCallback(() => setRevision((n) => n + 1), []);

  useEffect(() => {
    let cancelled = false;
    let busy = false;
    const partners = partnersKey.split('|').filter(Boolean);
    const groups = groupsKey.split('|').filter(Boolean);
    if (!userId) {
      setCounts(EMPTY);
      setError(null);
      setLoading(false);
      return;
    }
    const fetchAll = async () => {
      if (busy) return;
      busy = true;
      setLoading(true);
      try {
        // Cloud Function permite no máximo 20 IDs por chamada.
        const calls: Array<{ partnerIds: string[]; groupIds: string[] }> = [];
        for (let i = 0; i < partners.length; i += BATCH)
          calls.push({ partnerIds: partners.slice(i, i + BATCH), groupIds: [] });
        for (let i = 0; i < groups.length; i += BATCH)
          calls.push({ partnerIds: [], groupIds: groups.slice(i, i + BATCH) });
        if (!calls.length) calls.push({ partnerIds: [], groupIds: [] });
        const results = await Promise.all(
          calls.map(({ partnerIds, groupIds }) => fetchChatCounts(partnerIds, groupIds))
        );
        if (cancelled) return;
        const next: ChatCountsResponse = {
          privateTotal: results[0]?.privateTotal ?? 0,
          privateByPartner: {},
          groupById: {},
        };
        for (const r of results) {
          Object.assign(next.privateByPartner, r.privateByPartner);
          Object.assign(next.groupById, r.groupById);
        }
        setCounts(next);
        setError(null);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      } finally {
        busy = false;
        if (!cancelled) setLoading(false);
      }
    };
    void fetchAll();
    const timer = window.setInterval(() => void fetchAll(), 20000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [userId, partnersKey, groupsKey, revision]);

  return useMemo(() => ({ ...counts, loading, error, refresh }), [counts, loading, error, refresh]);
}
