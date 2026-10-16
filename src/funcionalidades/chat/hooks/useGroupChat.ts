import { useState, useEffect, useCallback } from 'react';
import { db } from '@/lib/firebase';
import { useApp } from '@/contexts/AppContext';
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  Timestamp,
  updateDoc,
  query,
  where,
  orderBy,
  limit,
} from 'firebase/firestore';
import { sendPushToUser } from '@/hooks/usePushNotifications';
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

const toIso = (value: any): string => {
  if (!value) return '';
  if (typeof value?.toDate === 'function') {
    return value.toDate().toISOString();
  }
  if (typeof value === 'string') return value;
  return '';
};

const mapMessage = (id: string, data: any): GroupMessage => ({
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

export function useGroupChat(groupId: string | null) {
  const { authenticatedUser } = useApp();

  const authenticatedUserId = authenticatedUser?.id ?? null;
  const authenticatedUsername = authenticatedUser?.username ?? null;

  const [messages, setMessages] = useState<GroupMessage[]>([]);

  useEffect(() => {
    if (!groupId || !authenticatedUserId) {
      setMessages([]);
      return;
    }

    const groupMessagesQuery = query(
      collection(db, 'group_messages'),
      where('group_id', '==', groupId),
      orderBy('created_at', 'desc'),
      limit(100)
    );

    const unsubscribe = onSnapshot(
      groupMessagesQuery,
      (snapshot) => {
        const next = snapshot.docs
          .map((messageDoc) => mapMessage(messageDoc.id, messageDoc.data()))
          .sort(
            (a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime()
          );

        setMessages(next);
      },
      (error) => {
        console.error('Erro ao carregar mensagens do grupo:', error);
        setMessages([]);
      }
    );

    return () => unsubscribe();
  }, [groupId, authenticatedUserId]);

  const sendMessage = useCallback(
    async (
      senderUsername: string,
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
      const verifiedSenderUsername = authenticatedUsername;

      await addDoc(collection(db, 'group_messages'), {
        group_id: groupId,
        sender_id: authenticatedUserId,
        sender_username: verifiedSenderUsername,
        content: msg.content,
        attachment_url: msg.attachmentUrl ?? null,
        attachment_type: msg.attachmentType ?? null,
        attachment_name: msg.attachmentName ?? null,
        edited: false,
        deleted: false,
        created_at: Timestamp.now(),
        updated_at: Timestamp.now(),
      });

      try {
        const groupSnapshot = await getDoc(doc(db, 'custom_groups', groupId));

        if (!groupSnapshot.exists()) return;

        const groupData = groupSnapshot.data();

        const participantIds: string[] = Array.isArray(groupData.participant_ids)
          ? groupData.participant_ids
          : [];

        if (participantIds.length === 0) return;

        const usersSnapshot = await getDocs(collection(db, 'users'));

        const matchingUsers = usersSnapshot.docs
          .map((userDoc) => ({
            id: userDoc.id,
            username: String(userDoc.data().username || '').trim(),
            active: userDoc.data().active !== false,
          }))
          .filter((user) => participantIds.includes(user.id));

        for (const user of matchingUsers) {
          if (user.id === authenticatedUserId || !user.active) {
            continue;
          }

          void sendPushToUser(
            user.id,
            'Nova mensagem de grupo',
            `${verifiedSenderUsername}: ${msg.content.substring(0, 100)}`,
            '/chat'
          );
        }
      } catch (error) {
        console.warn('Falha ao enviar push do grupo:', error);
      }
    },
    [groupId, authenticatedUserId, authenticatedUsername]
  );

  const editMessage = useCallback(
    async (msgId: string, newContent: string) => {
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
        throw new Error('Você só pode editar suas próprias mensagens');
      }

      if (data.deleted === true) {
        throw new Error('Não é possível editar uma mensagem apagada');
      }

      await updateDoc(messageRef, {
        content: newContent,
        edited: true,
        updated_at: Timestamp.now(),
      });
    },
    [authenticatedUserId]
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
    sendMessage,
    editMessage,
    deleteMessage,
  };
}
