import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Timestamp,
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  startAfter,
  where,
  type DocumentData,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { mapTask } from './useFirebaseTasks';
import type { CompletedTaskHistoryRow } from './useCompletedTaskHistory';

const PAGE = 25;
type Cursor = QueryDocumentSnapshot<DocumentData> | null;
type Stream = {
  alias: string;
  field: 'assignee_id' | 'assignee_ids';
  cursor: Cursor;
  exhausted: boolean;
};
const time = (value: unknown): Date | null => {
  if (
    value &&
    typeof value === 'object' &&
    'toDate' in value &&
    typeof (value as { toDate: unknown }).toDate === 'function'
  ) {
    return (value as { toDate: () => Date }).toDate();
  }
  return null;
};

/** Paginação por responsável. Não transfere páginas de outros funcionários. */
export function useArchivedTasksForBoard(enabled: boolean, userAliases: string[]) {
  const aliasesKey = [...new Set(userAliases.filter(Boolean))].sort().join('|');
  const [items, setItems] = useState<CompletedTaskHistoryRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const streams = useRef<Stream[]>([]);
  const generation = useRef(0);
  const busy = useRef(false);
  const initialPageRequested = useRef(false);
  useEffect(() => {
    generation.current++;
    busy.current = false;
    initialPageRequested.current = false;
    setItems([]);
    setError(null);
    setLoading(false);
    const aliases = aliasesKey.split('|').filter(Boolean);
    streams.current = aliases.flatMap((alias): Stream[] => [
      { alias, field: 'assignee_id', cursor: null, exhausted: false },
      { alias, field: 'assignee_ids', cursor: null, exhausted: false },
    ]);
    setHasMore(streams.current.length > 0);
  }, [aliasesKey, enabled]);

  const loadMore = useCallback(async () => {
    if (!enabled || busy.current || !hasMore) return;
    const active = streams.current.filter((s) => !s.exhausted);
    if (!active.length) {
      setHasMore(false);
      return;
    }
    busy.current = true;
    setLoading(true);
    const request = generation.current;
    try {
      const responses = await Promise.all(
        active.map(async (stream) => {
          // Consulta server-side por membro e marcador de arquivamento.
          // O índice composto deve estar implantado antes da ativação.
          const constraints = [
            where(
              stream.field,
              stream.field === 'assignee_ids' ? 'array-contains' : '==',
              stream.alias
            ),
            where('archived_at', '>', Timestamp.fromMillis(0)),
            orderBy('archived_at', 'desc'),
            limit(PAGE),
          ];
          const q = stream.cursor
            ? query(collection(db, 'tasks'), ...constraints, startAfter(stream.cursor))
            : query(collection(db, 'tasks'), ...constraints);
          return { stream, snapshot: await getDocs(q) };
        })
      );
      if (request !== generation.current) return;
      setItems((previous) => {
        const merged = new Map(previous.map((item) => [item.id, item]));
        for (const { stream, snapshot } of responses) {
          stream.cursor = snapshot.docs.at(-1) ?? stream.cursor;
          stream.exhausted = snapshot.size < PAGE;
          for (const entry of snapshot.docs) {
            const data = entry.data();
            if (data.status !== 'done') continue;
            merged.set(entry.id, {
              id: entry.id,
              title: String(data.title || ''),
              description: String(data.description || ''),
              createdAt: time(data.created_at),
              archivedAt: time(data.archived_at),
              assigneeId: String(data.assignee_id || ''),
              assigneeIds: Array.isArray(data.assignee_ids) ? data.assignee_ids.map(String) : [],
              archivedBy: String(data.archived_by || ''),
              status: String(data.status || ''),
              task: mapTask(entry.id, data),
            });
          }
        }
        return [...merged.values()].sort(
          (a, b) => (b.archivedAt?.getTime() || 0) - (a.archivedAt?.getTime() || 0)
        );
      });
      setHasMore(streams.current.some((s) => !s.exhausted));
    } catch (cause) {
      if (request === generation.current)
        setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      if (request === generation.current) {
        busy.current = false;
        setLoading(false);
      }
    }
  }, [enabled, hasMore]);

  useEffect(() => {
    if (!enabled || !aliasesKey || !hasMore || initialPageRequested.current) return;
    initialPageRequested.current = true;
    void loadMore();
  }, [enabled, aliasesKey, hasMore, loadMore]); // somente uma página inicial por abertura

  const removeItem = useCallback(
    (id: string) => setItems((previous) => previous.filter((item) => item.id !== id)),
    []
  );
  return { items, loading, error, hasMore, loadMore, removeItem };
}
