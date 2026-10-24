import { useCallback, useEffect, useRef, useState } from 'react';
import {
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
import { mapTask } from '@/hooks/useFirebaseTasks';
import type { Task } from '@/types';

/**
 * Histórico concluído paginado e sob demanda.
 * Não substitui o listener operacional de tarefas até os consumidores de
 * relatórios/quadros serem migrados e testados. Não altera documentos.
 */
export type CompletedTaskHistoryRow = {
  id: string;
  title: string;
  createdAt: Date | null;
  assigneeId: string;
  assigneeIds: string[];
  archivedAt: Date | null;
  archivedBy: string;
  status: string;
  description: string;
  task: Task;
};

const PAGE_SIZE = 25;

export function useCompletedTaskHistory(enabled = false) {
  const [items, setItems] = useState<CompletedTaskHistoryRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const cursor = useRef<QueryDocumentSnapshot<DocumentData> | null>(null);
  const busy = useRef(false);
  const generation = useRef(0);

  useEffect(() => {
    generation.current += 1;
    cursor.current = null;
    busy.current = false;
    setItems([]);
    setHasMore(true);
    setError(null);
    setLoading(false);
  }, [enabled]);

  const loadMore = useCallback(async () => {
    if (!enabled || busy.current || !hasMore) return;
    busy.current = true;
    setLoading(true);
    setError(null);
    const requestGeneration = generation.current;
    try {
      const base = [where('status', '==', 'done'), orderBy('created_at', 'desc'), limit(PAGE_SIZE)];
      const q = cursor.current
        ? query(collection(db, 'tasks'), ...base, startAfter(cursor.current))
        : query(collection(db, 'tasks'), ...base);
      const snapshot = await getDocs(q);
      if (requestGeneration !== generation.current) return;
      cursor.current = snapshot.docs.at(-1) ?? cursor.current;
      setItems((prev) => {
        const byId = new Map(prev.map((row) => [row.id, row]));
        snapshot.docs.forEach((item) => {
          const data = item.data();
          byId.set(item.id, {
            id: item.id,
            title: String(data.title || ''),
            createdAt: data.created_at?.toDate?.() ?? null,
            assigneeId: String(data.assignee_id || ''),
            assigneeIds: Array.isArray(data.assignee_ids) ? data.assignee_ids.map(String) : [],
            archivedAt: data.archived_at?.toDate?.() ?? null,
            archivedBy: String(data.archived_by || ''),
            status: String(data.status || ''),
            description: String(data.description || ''),
            task: mapTask(item.id, data),
          });
        });
        return [...byId.values()];
      });
      setHasMore(snapshot.size === PAGE_SIZE);
    } catch (cause) {
      if (requestGeneration === generation.current) {
        setError(cause instanceof Error ? cause.message : String(cause));
      }
    } finally {
      if (requestGeneration === generation.current) {
        busy.current = false;
        setLoading(false);
      }
    }
  }, [enabled, hasMore]);

  const initialRequested = useRef(false);
  useEffect(() => {
    if (!enabled) {
      initialRequested.current = false;
      return;
    }
    if (!initialRequested.current) {
      initialRequested.current = true;
      void loadMore();
    }
  }, [enabled, loadMore]);

  return { items, loading, error, hasMore, loadMore };
}
