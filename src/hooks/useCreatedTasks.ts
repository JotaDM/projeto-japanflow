import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { mapTask } from '@/hooks/useFirebaseTasks';
import type { Task } from '@/types';

/** Consulta as tarefas de um único criador; não faz leitura da coleção inteira. */
export function useCreatedTasks(creatorId?: string) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    setTasks([]);
    setError(null);
    if (!creatorId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const q = query(collection(db, 'tasks'), where('created_by', '==', creatorId));
    return onSnapshot(
      q,
      (snapshot) => {
        setTasks(
          snapshot.docs
            .map((d) => mapTask(d.id, d.data()))
            .filter((t) => t.assigneeId !== creatorId)
        );
        setLoading(false);
      },
      (cause) => {
        setError(cause.message);
        setLoading(false);
      }
    );
  }, [creatorId]);
  return { tasks, loading, error };
}
