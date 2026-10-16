import { useEffect, useState } from 'react';
import { collection, limit, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';

interface MessageData {
  senderId: string;
  receiverId: string;
  read?: boolean;
  deleted?: boolean;
}

// Este hook gerencia apenas o contador dentro do JapanFlow.
// Não dispara sons nem notificações do navegador.
export function useUnreadMessages(currentUserIdOrUsername: string | null) {
  const [totalUnread, setTotalUnread] = useState(0);
  const [resolvedUserId, setResolvedUserId] = useState<string | null>(null);

  useEffect(() => {
    if (!currentUserIdOrUsername) {
      setResolvedUserId(null);
      return;
    }

    // Compatibilidade com chamadas antigas que passam username.
    const unsubscribe = onSnapshot(
      collection(db, 'users'),
      (snapshot) => {
        const direct = snapshot.docs.find((userDoc) => userDoc.id === currentUserIdOrUsername);
        if (direct) {
          setResolvedUserId(direct.id);
          return;
        }
        const byUsername = snapshot.docs.find(
          (userDoc) => String(userDoc.data().username || '').trim() === currentUserIdOrUsername
        );
        setResolvedUserId(byUsername?.id || currentUserIdOrUsername);
      },
      (error) => {
        console.warn('Falha ao resolver usuário do contador de chat:', error);
        setResolvedUserId(currentUserIdOrUsername);
      }
    );

    return () => unsubscribe();
  }, [currentUserIdOrUsername]);

  useEffect(() => {
    if (!resolvedUserId) {
      setTotalUnread(0);
      return;
    }

    const messagesQuery = query(
      collection(db, 'messages'),
      where('receiverId', '==', resolvedUserId),
      limit(100)
    );

    const unsubscribe = onSnapshot(
      messagesQuery,
      (snapshot) => {
        const unreadCount = snapshot.docs.reduce((count, messageDoc) => {
          const message = messageDoc.data() as MessageData;
          return count + (message.read !== true && message.deleted !== true ? 1 : 0);
        }, 0);
        setTotalUnread(unreadCount);
      },
      (error) => console.error('Erro ao acompanhar mensagens não lidas:', error)
    );

    return () => unsubscribe();
  }, [resolvedUserId]);

  return { totalUnread };
}
