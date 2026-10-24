import { useCallback, useSyncExternalStore } from 'react';
import { collection, limit, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';

type Listener = () => void;
type Entry = { value: number; listeners: Set<Listener>; stop: () => void };
const stores = new Map<string, Entry>();

function subscribe(userId: string, notify: Listener): () => void {
  let entry = stores.get(userId);
  if (!entry) {
    entry = { value: 0, listeners: new Set(), stop: () => undefined };
    stores.set(userId, entry);
    const active = entry;
    active.stop = onSnapshot(
      query(collection(db, 'messages'), where('receiverId', '==', userId), limit(100)),
      (snapshot) => {
        active.value = snapshot.docs.reduce((count, message) => {
          const data = message.data();
          return count + (data.read !== true && data.deleted !== true ? 1 : 0);
        }, 0);
        active.listeners.forEach((listener) => listener());
      },
      (error) => console.error('Erro ao acompanhar mensagens não lidas:', error)
    );
  }
  entry.listeners.add(notify);
  return () => {
    entry!.listeners.delete(notify);
    if (entry!.listeners.size === 0) {
      entry!.stop();
      stores.delete(userId);
    }
  };
}

// Os consumidores passam o ID autenticado, não o username.
// Duas instâncias do hook compartilham uma única assinatura por ID.
export function useUnreadMessages(userId: string | null) {
  const listen = useCallback(
    (notify: Listener) => (userId ? subscribe(userId, notify) : () => undefined),
    [userId]
  );
  const snapshot = useCallback(() => (userId ? (stores.get(userId)?.value ?? 0) : 0), [userId]);
  const totalUnread = useSyncExternalStore(listen, snapshot, () => 0);
  return { totalUnread };
}
