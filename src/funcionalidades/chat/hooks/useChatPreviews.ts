import { useState, useEffect, useCallback } from 'react';
import { db } from '@/lib/firebase';
import { useChatUnreadCounts } from '@/hooks/useChatUnreadCounts';
import {
  collection,
  doc,
  onSnapshot,
  setDoc,
  Timestamp,
  query,
  where,
  orderBy,
  limit,
} from 'firebase/firestore';
export interface ChatPreview {
  partnerUsername: string;
  lastMessageAt: string;
  lastMessageContent: string;
  unreadCount: number;
}

const toIso = (value: any): string => {
  if (!value) return '';
  if (value?.toDate) return value.toDate().toISOString();
  if (typeof value === 'string') return value;
  return '';
};

export function useChatPreviews(
  currentUsername: string | null,
  directory?: Array<{ id: string; username: string }>
) {
  const [previews, setPreviews] = useState<ChatPreview[]>([]);
  const [usersMap, setUsersMap] = useState({
    idToUsername: new Map<string, string>(),
    usernameToId: new Map<string, string>(),
  });
  const [messagesSnapshot, setMessagesSnapshot] = useState<any[]>([]);
  const userId = currentUsername ? usersMap.usernameToId.get(currentUsername) || null : null;
  const partnerIds = Array.from(usersMap.idToUsername.keys()).filter((id) => id !== userId);
  const { privateByPartner, refresh: refreshCounts } = useChatUnreadCounts(userId, partnerIds);

  useEffect(() => {
    if (directory) {
      const idToUsername = new Map<string, string>();
      const usernameToId = new Map<string, string>();
      directory.forEach((user) => {
        const name = user.username?.trim();
        if (!name) return;
        idToUsername.set(user.id, name);
        usernameToId.set(name, user.id);
      });
      setUsersMap({ idToUsername, usernameToId });
      return;
    }
    const unsubscribe = onSnapshot(
      collection(db, 'users'),
      (snapshot) => {
        const idToUsername = new Map<string, string>();
        const usernameToId = new Map<string, string>();

        snapshot.docs.forEach((userDoc) => {
          const data = userDoc.data();
          const username = String(data.username || '').trim();
          if (!username) return;
          idToUsername.set(userDoc.id, username);
          usernameToId.set(username, userDoc.id);
        });

        setUsersMap({ idToUsername, usernameToId });
      },
      (error) => console.error('Erro ao carregar usuários para previews do chat:', error)
    );

    return () => unsubscribe();
  }, [directory]);

  useEffect(() => {
    const userId = currentUsername ? usersMap.usernameToId.get(currentUsername) : null;

    if (!userId) {
      setMessagesSnapshot([]);
      return;
    }

    // Busca mensagens recentes nos dois sentidos. O limite anterior sem
    // orderBy podia retornar mensagens antigas em vez das mais recentes.
    // Os contadores refletem a janela carregada, não todo o histórico.
    const sentQuery = query(
      collection(db, 'messages'),
      where('senderId', '==', userId),
      orderBy('timestamp', 'desc'),
      limit(100)
    );
    const receivedQuery = query(
      collection(db, 'messages'),
      where('receiverId', '==', userId),
      orderBy('timestamp', 'desc'),
      limit(100)
    );
    let sent: any[] = [];
    let received: any[] = [];
    const publish = () => {
      const merged = new Map<string, any>();
      for (const message of [...sent, ...received]) merged.set(message.id, message);
      setMessagesSnapshot([...merged.values()]);
    };
    const handleError = (error: Error) => {
      console.error('Erro ao carregar mensagens para previews:', error);
    };
    const unsubSent = onSnapshot(
      sentQuery,
      (snapshot) => {
        sent = snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() }));
        publish();
      },
      handleError
    );
    const unsubReceived = onSnapshot(
      receivedQuery,
      (snapshot) => {
        received = snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() }));
        publish();
      },
      handleError
    );
    return () => {
      unsubSent();
      unsubReceived();
    };
  }, [currentUsername, usersMap]);

  const rebuildPreviews = useCallback(() => {
    if (!currentUsername) {
      setPreviews([]);
      return;
    }

    const currentUserId = usersMap.usernameToId.get(currentUsername);
    if (!currentUserId) {
      setPreviews([]);
      return;
    }

    const rows = messagesSnapshot
      .map((message) => {
        const senderId = String(message.senderId || '');
        const receiverId = String(message.receiverId || '');
        const createdAt = toIso(message.timestamp || message.created_at || message.createdAt);

        return {
          ...message,
          senderId,
          receiverId,
          createdAt,
          deleted: message.deleted === true,
          read: message.read === true,
          content: String(message.content || ''),
        };
      })
      .filter(
        (message) => message.senderId === currentUserId || message.receiverId === currentUserId
      )
      .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());

    const chatMap = new Map<string, { lastMsg: any }>();

    for (const message of rows) {
      const partnerId = message.senderId === currentUserId ? message.receiverId : message.senderId;
      const partnerUsername = usersMap.idToUsername.get(partnerId);
      if (!partnerUsername) continue;

      if (!chatMap.has(partnerUsername)) {
        chatMap.set(partnerUsername, { lastMsg: message });
      }
    }

    const result = Array.from(chatMap.entries()).map(([partnerUsername, value]): ChatPreview => ({
      partnerUsername,
      lastMessageAt: value.lastMsg.createdAt,
      lastMessageContent: value.lastMsg.deleted ? 'Mensagem apagada' : value.lastMsg.content,
      unreadCount: privateByPartner[usersMap.usernameToId.get(partnerUsername) || ''] ?? 0,
    }));

    result.sort(
      (a, b) => new Date(b.lastMessageAt || 0).getTime() - new Date(a.lastMessageAt || 0).getTime()
    );

    setPreviews(result);
  }, [currentUsername, messagesSnapshot, usersMap, privateByPartner]);

  useEffect(() => rebuildPreviews(), [rebuildPreviews]);

  const markAsRead = useCallback(
    async (partnerUsername: string) => {
      if (!currentUsername) return;

      const statusId = `${currentUsername}__${partnerUsername}`;
      await setDoc(
        doc(db, 'chat_read_status', statusId),
        {
          username: currentUsername,
          partner_username: partnerUsername,
          userId: usersMap.usernameToId.get(currentUsername) || null,
          partnerId: usersMap.usernameToId.get(partnerUsername) || null,
          last_read_at: Timestamp.now(),
          updated_at: Timestamp.now(),
        },
        { merge: true }
      );
      refreshCounts();
    },
    [currentUsername, usersMap, refreshCounts]
  );

  return { previews, markAsRead };
}
