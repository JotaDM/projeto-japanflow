import { useState, useCallback } from 'react';
import { db } from '@/lib/firebase';
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  getDocs,
  startAfter,
  addDoc,
  updateDoc,
  doc,
  getDoc,
  setDoc,
  Timestamp,
  where,
  limit,
  serverTimestamp,
  deleteField,
  type FieldValue,
  type QueryDocumentSnapshot,
  type DocumentData,
} from 'firebase/firestore';
import { useApp } from '@/contexts/AppContext';
import { ChatMessage } from '@/types';

interface MessageData {
  content: string;
  replyToId?: string | null;
  replyToContent?: string | null;
  replyToSenderId?: string | null;
  senderId: string;
  receiverId: string;
  timestamp: Timestamp | FieldValue;
  read: boolean;
  read_at?: Timestamp | FieldValue | null;
  reactions?: Record<string, string>;
  attachmentUrl?: string | null;
  attachmentType?: 'image' | 'file' | 'audio' | null;
  attachmentName?: string | null;
  edited?: boolean;
  deleted?: boolean;
}

interface SendMessageInput {
  content: string;
  replyToId?: string;
  replyToContent?: string;
  replyToSenderId?: string;
  receiverId: string;
  attachmentUrl?: string;
  attachmentType?: 'image' | 'file' | 'audio';
  attachmentName?: string;
}

const PAGE_SIZE = 20;

function messageTime(value: unknown): number {
  if (value instanceof Timestamp) return value.toMillis();
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function toChatMessage(snapshot: QueryDocumentSnapshot<DocumentData>): ChatMessage {
  const data = snapshot.data({ serverTimestamps: 'estimate' }) as MessageData;
  const time = messageTime(data.timestamp);
  return {
    id: snapshot.id,
    content: data.content,
    replyToId: data.replyToId ?? undefined,
    replyToContent: data.replyToContent ?? undefined,
    replyToSenderId: data.replyToSenderId ?? undefined,
    senderId: data.senderId,
    receiverId: data.receiverId,
    timestamp: new Date(time).toISOString(),
    attachmentUrl: data.attachmentUrl ?? undefined,
    attachmentType: data.attachmentType ?? undefined,
    attachmentName: data.attachmentName ?? undefined,
    edited: data.edited ?? false,
    deleted: data.deleted ?? false,
    read: data.read === true,
    readAt: data.read_at ? new Date(messageTime(data.read_at)).toISOString() : undefined,
    reactions: data.reactions ?? {},
  };
}

export const useChat = () => {
  const { authenticatedUser: currentUser } = useApp();
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  const sendMessage = useCallback(
    async (msg: SendMessageInput) => {
      if (!currentUser?.id) return;

      const newMessage: MessageData = {
        content: msg.content,
        replyToId: msg.replyToId ?? null,
        replyToContent: msg.replyToContent ?? null,
        replyToSenderId: msg.replyToSenderId ?? null,
        senderId: currentUser.id,
        receiverId: msg.receiverId,
        timestamp: serverTimestamp(),
        read: false,
        read_at: null,
        reactions: {},
        attachmentUrl: msg.attachmentUrl ?? null,
        attachmentType: msg.attachmentType ?? null,
        attachmentName: msg.attachmentName ?? null,
        edited: false,
        deleted: false,
      };

      // A mensagem é a operação principal. Falha no aviso não deve provocar
      // uma segunda tentativa de envio e uma mensagem duplicada.
      let messageRef;
      try {
        messageRef = await addDoc(collection(db, 'messages'), newMessage);
      } catch (error) {
        console.error('Erro ao enviar mensagem:', error);
        return;
      }

      try {
        const preferenceId = `${msg.receiverId}__${currentUser.id}`;
        const preferenceSnapshot = await getDoc(doc(db, 'chat_preferences', preferenceId));
        const mutedByReceiver = preferenceSnapshot.data()?.muted === true;

        if (!mutedByReceiver) {
          // ID determinístico: uma notificação interna por mensagem.
          // Não envia push FCM para mensagens.
          await setDoc(doc(db, 'notifications', `chat_${messageRef.id}`), {
            user_id: msg.receiverId,
            message: `Nova mensagem recebida de ${currentUser.name || currentUser.username}`,
            type: 'chat_message',
            read: false,
            read_at: null,
            message_id: messageRef.id,
            created_at: Timestamp.now(),
          });
        }
      } catch (error) {
        console.warn('Mensagem enviada, mas a notificação interna falhou:', error);
      }
    },
    [currentUser?.id, currentUser?.name, currentUser?.username]
  );

  const reactToMessage = useCallback(
    async (messageId: string, emoji: string | null) => {
      if (!currentUser?.id) return;
      const allowed = ['👍', '❤️', '😂', '😮', '🙏', '🔥'];
      if (emoji !== null && !allowed.includes(emoji)) return;
      try {
        await updateDoc(doc(db, 'messages', messageId), {
          [`reactions.${currentUser.id}`]: emoji ?? deleteField(),
        });
      } catch (error) {
        console.error('Não foi possível reagir à mensagem:', error);
      }
    },
    [currentUser?.id]
  );

  const deleteMessage = useCallback(async (messageId: string) => {
    try {
      await updateDoc(doc(db, 'messages', messageId), {
        deleted: true,
        content: 'Mensagem apagada',
      });
    } catch (error) {
      console.error('Erro ao apagar mensagem:', error);
    }
  }, []);

  const markMessageAsRead = useCallback(async (messageId: string) => {
    try {
      await updateDoc(doc(db, 'messages', messageId), { read: true, read_at: serverTimestamp() });
    } catch (error) {
      console.error('Erro ao marcar mensagem como lida:', error);
    }
  }, []);

  // Abre apenas as últimas mensagens de cada direção. Histórico: páginas sob demanda.
  const getMessagesForChat = useCallback((currentUserId: string, otherUserId: string) => {
    type Snapshot = QueryDocumentSnapshot<DocumentData>;
    type Direction = 'sent' | 'received';
    const base = (direction: Direction, cursor?: Snapshot) => {
      const [sender, receiver] =
        direction === 'sent' ? [currentUserId, otherUserId] : [otherUserId, currentUserId];
      const constraints = [
        where('senderId', '==', sender),
        where('receiverId', '==', receiver),
        orderBy('timestamp', 'desc'),
        limit(PAGE_SIZE),
      ];
      return cursor
        ? query(collection(db, 'messages'), ...constraints, startAfter(cursor))
        : query(collection(db, 'messages'), ...constraints);
    };
    const history: Record<Direction, Snapshot[]> = { sent: [], received: [] };
    const current: Record<Direction, Snapshot[]> = { sent: [], received: [] };
    const cursor: Record<Direction, Snapshot | null> = { sent: null, received: null };
    const exhausted: Record<Direction, boolean> = { sent: false, received: false };
    const ready = { sent: false, received: false };
    const pendingReads = new Set<string>();
    let active = true;
    let busy = false;

    const publish = () => {
      if (!active || !ready.sent || !ready.received) return;
      const docs = new Map<string, Snapshot>();
      for (const item of [
        ...history.sent,
        ...history.received,
        ...current.sent,
        ...current.received,
      ]) {
        docs.set(item.id, item);
      }
      setMessages(
        [...docs.values()]
          .sort(
            (a, b) =>
              messageTime(a.data().timestamp) - messageTime(b.data().timestamp) ||
              a.id.localeCompare(b.id)
          )
          .map(toChatMessage)
      );
      for (const item of [...history.received, ...current.received]) {
        const data = item.data() as MessageData;
        if (data.read || data.deleted || pendingReads.has(item.id)) continue;
        pendingReads.add(item.id);
        void updateDoc(doc(db, 'messages', item.id), { read: true, read_at: serverTimestamp() })
          .catch((e) => console.warn('Falha ao marcar mensagem como lida:', e))
          .finally(() => pendingReads.delete(item.id));
      }
    };
    const stops = (['sent', 'received'] as const).map((direction) =>
      onSnapshot(
        base(direction),
        (snap) => {
          current[direction] = snap.docs;
          if (!ready[direction]) {
            ready[direction] = true;
            cursor[direction] = snap.docs.at(-1) ?? null;
            exhausted[direction] = snap.size < PAGE_SIZE;
          }
          publish();
        },
        (error) => console.error('Erro ao acompanhar conversa:', error)
      )
    );
    const loadOlder = async () => {
      if (!active || busy || !ready.sent || !ready.received) return false;
      busy = true;
      try {
        const directions = (['sent', 'received'] as const).filter(
          (d) => !exhausted[d] && cursor[d]
        );
        if (!directions.length) return false;
        const result = await Promise.all(
          directions.map(async (d) => ({
            direction: d,
            snapshot: await getDocs(base(d, cursor[d]!)),
          }))
        );
        if (!active) return false;
        for (const { direction, snapshot } of result) {
          history[direction] = [...history[direction], ...snapshot.docs];
          cursor[direction] = snapshot.docs.at(-1) ?? cursor[direction];
          exhausted[direction] = snapshot.size < PAGE_SIZE;
        }
        publish();
        return result.some(({ snapshot }) => !snapshot.empty);
      } catch (error) {
        console.error('Erro ao carregar mensagens antigas:', error);
        return false;
      } finally {
        busy = false;
      }
    };
    const stop = () => {
      active = false;
      stops.forEach((unsubscribe) => unsubscribe());
    };
    return { stop, loadOlder };
  }, []);

  return {
    reactToMessage,
    messages,
    sendMessage,
    deleteMessage,
    markMessageAsRead,
    getMessagesForChat,
  };
};
