import { useState, useCallback } from 'react';
import { db } from '@/lib/firebase';
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  addDoc,
  updateDoc,
  doc,
  getDoc,
  setDoc,
  Timestamp,
  where,
  limit,
  serverTimestamp,
  type FieldValue,
  type QueryDocumentSnapshot,
  type DocumentData,
} from 'firebase/firestore';
import { useApp } from '@/contexts/AppContext';
import { ChatMessage } from '@/types';

interface MessageData {
  content: string;
  senderId: string;
  receiverId: string;
  timestamp: Timestamp | FieldValue;
  read: boolean;
  attachmentUrl?: string | null;
  attachmentType?: 'image' | 'file' | 'audio' | null;
  attachmentName?: string | null;
  edited?: boolean;
  deleted?: boolean;
}

interface SendMessageInput {
  content: string;
  receiverId: string;
  attachmentUrl?: string;
  attachmentType?: 'image' | 'file' | 'audio';
  attachmentName?: string;
}

const MAX_MESSAGES_PER_DIRECTION = 100;

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
    senderId: data.senderId,
    receiverId: data.receiverId,
    timestamp: new Date(time).toISOString(),
    attachmentUrl: data.attachmentUrl ?? undefined,
    attachmentType: data.attachmentType ?? undefined,
    attachmentName: data.attachmentName ?? undefined,
    edited: data.edited ?? false,
    deleted: data.deleted ?? false,
    read: data.read === true,
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
        senderId: currentUser.id,
        receiverId: msg.receiverId,
        timestamp: serverTimestamp(),
        read: false,
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
      await updateDoc(doc(db, 'messages', messageId), { read: true });
    } catch (error) {
      console.error('Erro ao marcar mensagem como lida:', error);
    }
  }, []);

  const getMessagesForChat = useCallback((currentUserId: string, otherUserId: string) => {
    // Cada consulta é restrita ao par de participantes, evitando que conversas
    // com outras pessoas consumam o limite das últimas mensagens.
    const sentQuery = query(
      collection(db, 'messages'),
      where('senderId', '==', currentUserId),
      where('receiverId', '==', otherUserId),
      orderBy('timestamp', 'desc'),
      limit(MAX_MESSAGES_PER_DIRECTION)
    );
    const receivedQuery = query(
      collection(db, 'messages'),
      where('senderId', '==', otherUserId),
      where('receiverId', '==', currentUserId),
      orderBy('timestamp', 'desc'),
      limit(MAX_MESSAGES_PER_DIRECTION)
    );

    let sentDocs: QueryDocumentSnapshot<DocumentData>[] = [];
    let receivedDocs: QueryDocumentSnapshot<DocumentData>[] = [];
    let sentReady = false;
    let receivedReady = false;
    let active = true;
    const readUpdatesInFlight = new Set<string>();

    const publish = () => {
      if (!active || !sentReady || !receivedReady) return;
      const docs = new Map<string, QueryDocumentSnapshot<DocumentData>>();
      for (const messageDoc of [...sentDocs, ...receivedDocs]) docs.set(messageDoc.id, messageDoc);

      const sortedDocs = [...docs.values()].sort((a, b) => {
        const difference = messageTime(a.data().timestamp) - messageTime(b.data().timestamp);
        return difference || a.id.localeCompare(b.id);
      });

      const orderedMessages = sortedDocs.map(toChatMessage);

      console.table(
        orderedMessages.slice(-12).map((message, index) => ({
          posicao: index,
          id: message.id.slice(0, 8),
          remetente: message.senderId,
          horarioExato: message.timestamp,
          conteudo: message.content.slice(0, 35),
        }))
      );

      setMessages(orderedMessages);

      for (const messageDoc of receivedDocs) {
        const data = messageDoc.data() as MessageData;
        if (data.read === true || data.deleted === true || readUpdatesInFlight.has(messageDoc.id)) {
          continue;
        }
        readUpdatesInFlight.add(messageDoc.id);
        void updateDoc(doc(db, 'messages', messageDoc.id), { read: true })
          .catch((error) => console.warn('Falha ao marcar mensagem como lida:', error))
          .finally(() => readUpdatesInFlight.delete(messageDoc.id));
      }
    };

    const unsubscribeSent = onSnapshot(
      sentQuery,
      (snapshot) => {
        sentDocs = snapshot.docs;
        sentReady = true;
        publish();
      },
      (error) => console.error('Erro ao carregar mensagens enviadas:', error)
    );

    const unsubscribeReceived = onSnapshot(
      receivedQuery,
      (snapshot) => {
        receivedDocs = snapshot.docs;
        receivedReady = true;
        publish();
      },
      (error) => console.error('Erro ao carregar mensagens recebidas:', error)
    );

    return () => {
      active = false;
      unsubscribeSent();
      unsubscribeReceived();
    };
  }, []);

  return {
    messages,
    sendMessage,
    deleteMessage,
    markMessageAsRead,
    getMessagesForChat,
  };
};
