import { useEffect, useMemo, useState } from 'react';
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  writeBatch,
  where,
  limit,
} from 'firebase/firestore';
import { useApp } from '@/contexts/AppContext';
import { db } from '@/lib/firebase';
export type SystemNotification = {
  id: string;
  recipient_user_id: string;
  type: string;
  source: string;
  title: string;
  message: string;
  severity: 'info' | 'attention' | 'warning' | 'critical';
  budget_percentage?: number;
  cost_amount?: number;
  budget_amount?: number;
  read: boolean;
  created_at?: {
    toDate?: () => Date;
  };
};
export function useSystemNotifications() {
  const { authenticatedUser } = useApp();
  const [notifications, setNotifications] = useState<SystemNotification[]>([]);
  useEffect(() => {
    if (!authenticatedUser?.id) {
      setNotifications([]);
      return;
    }
    const notificationsQuery = query(
      collection(db, 'system_notifications'),
      where('recipient_user_id', '==', authenticatedUser.id),
      orderBy('created_at', 'desc'),
      limit(50)
    );
    return onSnapshot(
      notificationsQuery,
      (snapshot) => {
        setNotifications(
          snapshot.docs.map((item) => ({
            id: item.id,
            ...item.data(),
          })) as SystemNotification[]
        );
      },
      (error) => {
        console.warn('Não foi possível carregar as notificações do sistema:', error);
      }
    );
  }, [authenticatedUser?.id]);
  // As regras de segurança permitem alterar read, mas não excluir avisos do sistema.
  // Limpar significa dispensar os avisos visíveis ao usuário sem apagar o histórico.
  const dismissAll = async () => {
    const pending = notifications.filter((item) => !item.read);
    for (let i = 0; i < pending.length; i += 400) {
      const batch = writeBatch(db);
      for (const item of pending.slice(i, i + 400)) {
        batch.update(doc(db, 'system_notifications', item.id), { read: true });
      }
      await batch.commit();
    }
  };
  const visibleNotifications = useMemo(
    () => notifications.filter((item) => !item.read),
    [notifications]
  );
  const unreadCount = useMemo(
    () => notifications.filter((notification) => !notification.read).length,
    [notifications]
  );
  const markAsRead = async (id: string) => {
    await updateDoc(doc(db, 'system_notifications', id), {
      read: true,
    });
  };
  return {
    notifications: visibleNotifications,
    unreadCount,
    dismissAll,
    markAsRead,
  };
}
