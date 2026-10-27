import { useState, useEffect, useCallback, useRef } from 'react';
import { db } from '@/lib/firebase';
import { useApp } from '@/contexts/AppContext';
import {
  addDoc,
  collection,
  doc,
  getDoc,
  onSnapshot,
  Timestamp,
  updateDoc,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  startAfter,
  type QueryDocumentSnapshot,
  type DocumentData,
} from 'firebase/firestore';

export interface GroupMessage {
  id: string;
  group_id: string;
  sender_id: string;
  sender_username: string;
  content: string;
  attachment_url: string | null;
  attachment_type: string | null;
  attachment_name: string | null;
  edited: boolean;
  deleted: boolean;
  created_at: string;
}

const toIso = (value: unknown): string => {
  if (!value) return '';

  if (
    typeof value === 'object' &&
    value !== null &&
    'toDate' in value &&
    typeof value.toDate === 'function'
  ) {
    return (value.toDate() as Date).toISOString();
  }

  if (typeof value === 'string') return value;

  return '';
};

const mapMessage = (id: string, data: Record<string, any>): GroupMessage => ({
  id,
  group_id: data.group_id || '',
  sender_id: data.sender_id || '',
  sender_username: data.sender_username || '',
  content: data.content || '',
  attachment_url: data.attachment_url || null,
  attachment_type: data.attachment_type || null,
  attachment_name: data.attachment_name || null,
  edited: data.edited === true,
  deleted: data.deleted === true,
  created_at: toIso(data.created_at),
});

const sortMessages = (a: GroupMessage, b: GroupMessage): number => {
  const timeA = Date.parse(a.created_at);
  const timeB = Date.parse(b.created_at);

  const validTimeA = Number.isFinite(timeA) ? timeA : 0;
  const validTimeB = Number.isFinite(timeB) ? timeB : 0;

  if (validTimeA !== validTimeB) {
    return validTimeA - validTimeB;
  }

  return a.id.localeCompare(b.id);
};

export function useGroupChat(groupId: string | null) {
  const { authenticatedUser } = useApp();

  const authenticatedUserId = authenticatedUser?.id ?? null;
  const authenticatedUsername = authenticatedUser?.username ?? null;

  const [messages, setMessages] = useState<GroupMessage[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const cursorRef = useRef<QueryDocumentSnapshot<DocumentData> | null>(null);
  const olderRef = useRef<GroupMessage[]>([]);
  const loadingRef = useRef(false);
  const generation = useRef(0);

  useEffect(() => {
    generation.current++;
    olderRef.current = [];
    cursorRef.current = null;
    setHasMore(false);
    if (!groupId || !authenticatedUserId) {
      setMessages([]);
      return;
    }

    const groupMessagesQuery = query(
      collection(db, 'group_messages'),
      where('group_id', '==', groupId),
      orderBy('created_at', 'desc'),
      limit(20)
    );

    const unsubscribe = onSnapshot(
      groupMessagesQuery,
      (snapshot) => {
        if (!cursorRef.current) {
          cursorRef.current = snapshot.docs.at(-1) ?? null;
          setHasMore(snapshot.size === 20);
        }
        const merged = new Map(olderRef.current.map((item) => [item.id, item]));
        snapshot.docs.forEach((entry) => merged.set(entry.id, mapMessage(entry.id, entry.data())));
        setMessages([...merged.values()].sort(sortMessages));
      },
      (error) => {
        console.error('Erro ao carregar mensagens do grupo:', error);
        setMessages([]);
      }
    );

    return () => unsubscribe();
  }, [groupId, authenticatedUserId]);

  const loadOlder = useCallback(async (): Promise<boolean> => {
    if (!groupId || loadingRef.current || !cursorRef.current || !hasMore) return false;
    loadingRef.current = true;
    const request = generation.current;
    try {
      const snap = await getDocs(
        query(
          collection(db, 'group_messages'),
          where('group_id', '==', groupId),
          orderBy('created_at', 'desc'),
          startAfter(cursorRef.current),
          limit(20)
        )
      );
      if (request !== generation.current) return false;
      cursorRef.current = snap.docs.at(-1) ?? cursorRef.current;
      setHasMore(snap.size === 20);
      const merged = new Map(olderRef.current.map((item) => [item.id, item]));
      snap.docs.forEach((entry) => merged.set(entry.id, mapMessage(entry.id, entry.data())));
      olderRef.current = [...merged.values()];
      setMessages((current) => {
        const all = new Map([...olderRef.current, ...current].map((item) => [item.id, item]));
        return [...all.values()].sort(sortMessages);
      });
      return !snap.empty;
    } catch (error) {
      console.error('Erro ao carregar mensagens antigas do grupo:', error);
      return false;
    } finally {
      loadingRef.current = false;
    }
  }, [groupId, hasMore]);

  const sendMessage = useCallback(
    async (
      _senderUsername: string,
      msg: {
        content: string;
        attachmentUrl?: string;
        attachmentType?: string;
        attachmentName?: string;
      }
    ) => {
      if (!groupId) return;

      if (!authenticatedUserId || !authenticatedUsername) {
        throw new Error('Usuário não autenticado');
      }

      // O remetente é determinado pela sessão autenticada,
      // nunca pelo parâmetro recebido do componente.
      await addDoc(collection(db, 'group_messages'), {
        group_id: groupId,
        sender_id: authenticatedUserId,
        sender_username: authenticatedUsername,
        content: msg.content,
        attachment_url: msg.attachmentUrl ?? null,
        attachment_type: msg.attachmentType ?? null,
        attachment_name: msg.attachmentName ?? null,
        edited: false,
        deleted: false,
        created_at: Timestamp.now(),
        updated_at: Timestamp.now(),
      });

      // Mensagens em grupo não disparam push externo.
      // O acompanhamento ocorre pelo próprio JapanFlow.
    },
    [groupId, authenticatedUserId, authenticatedUsername]
  );

  const deleteMessage = useCallback(
    async (msgId: string) => {
      if (!authenticatedUserId) {
        throw new Error('Usuário não autenticado');
      }

      const messageRef = doc(db, 'group_messages', msgId);
      const messageSnapshot = await getDoc(messageRef);

      if (!messageSnapshot.exists()) {
        throw new Error('Mensagem não encontrada');
      }

      const data = messageSnapshot.data();

      if (data.sender_id !== authenticatedUserId) {
        throw new Error('Você só pode apagar suas próprias mensagens');
      }

      await updateDoc(messageRef, {
        deleted: true,
        content: 'Mensagem apagada',
        updated_at: Timestamp.now(),
      });
    },
    [authenticatedUserId]
  );

  return {
    messages,
    hasMore,
    loadOlder,
    sendMessage,
    deleteMessage,
  };
}
