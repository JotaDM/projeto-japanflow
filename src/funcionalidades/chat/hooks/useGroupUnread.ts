import { useCallback, useMemo } from 'react';
import { doc, setDoc, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useChatUnreadCounts } from '@/hooks/useChatUnreadCounts';

export function useGroupUnread(
  currentUserId: string | null | undefined,
  currentUsername: string | null | undefined,
  accessibleGroupIds: string[]
) {
  const { groupById, refresh, error, loading } = useChatUnreadCounts(
    currentUserId,
    [],
    accessibleGroupIds
  );
  const unreadByGroup = groupById;
  const totalUnread = useMemo(
    () => Object.values(unreadByGroup).reduce((sum, count) => sum + count, 0),
    [unreadByGroup]
  );

  const markGroupAsRead = useCallback(
    async (groupId: string) => {
      if (!currentUserId || !currentUsername || !groupId) return;
      const now = Timestamp.now();
      await setDoc(
        doc(db, 'chat_read_status', `${currentUserId}__group__${groupId}`),
        {
          user_id: currentUserId,
          username: currentUsername,
          group_id: groupId,
          last_read_at: now,
          updated_at: now,
        },
        { merge: true }
      );
      refresh();
    },
    [currentUserId, currentUsername, refresh]
  );

  return { unreadByGroup, totalUnread, markGroupAsRead, error, loading };
}
