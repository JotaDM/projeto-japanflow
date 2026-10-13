import { useState, useEffect, useCallback } from 'react';
import { db } from '@/lib/firebase';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  Timestamp,
} from 'firebase/firestore';

export interface CustomGroup {
  participantIds: string[];
  id: string;
  name: string;
  createdBy: string;
  participants: string[];
  createdAt: string;
}

const toIso = (value: any): string => {
  if (!value) return '';
  if (value?.toDate) return value.toDate().toISOString();
  if (typeof value === 'string') return value;
  return '';
};

export function useCustomGroups() {
  const [groups, setGroups] = useState<CustomGroup[]>([]);

  useEffect(() => {
    const groupsQuery = query(collection(db, 'custom_groups'), orderBy('created_at', 'desc'));

    const unsubscribe = onSnapshot(
      groupsQuery,
      (snapshot) => {
        setGroups(
          snapshot.docs.map((groupDoc) => {
            const data = groupDoc.data();

            return {
              participantIds: Array.isArray(data.participant_ids) ? data.participant_ids : [],
              id: groupDoc.id,
              name: data.name || '',
              createdBy: data.created_by || '',
              participants: Array.isArray(data.participants) ? data.participants : [],
              createdAt: toIso(data.created_at),
            };
          })
        );
      },
      (error) => {
        console.error('Erro ao carregar grupos:', error);
      }
    );

    return () => unsubscribe();
  }, []);

  const createGroup = useCallback(
    async (name: string, participants: string[], createdBy: string) => {
      const usersSnapshot = await getDocs(collection(db, 'users'));

      const users = usersSnapshot.docs.map((userDoc) => ({
        id: userDoc.id,
        username: String(userDoc.data().username || '').trim(),
        active: userDoc.data().active !== false,
      }));

      const participantIds = new Set<string>();

      for (const participant of participants) {
        const value = participant.trim();

        const user = users.find(
          (candidate) =>
            candidate.id === value ||
            (candidate.username === value && candidate.username.length > 0)
        );

        if (!user || !user.active) {
          throw new Error(`Participante inválido ou inativo: ${value}`);
        }

        participantIds.add(user.id);
      }

      const creator = users.find((user) => user.id === createdBy && user.active);

      if (!creator) {
        throw new Error('Criador do grupo inválido ou inativo');
      }

      participantIds.add(creator.id);

      await addDoc(collection(db, 'custom_groups'), {
        name,
        participants,
        participant_ids: [...participantIds],
        created_by: createdBy,
        created_at: Timestamp.now(),
        updated_at: Timestamp.now(),
      });
    },
    []
  );

  const deleteGroup = useCallback(async (id: string) => {
    await deleteDoc(doc(db, 'custom_groups', id));
  }, []);

  return {
    groups,
    createGroup,
    deleteGroup,
  };
}
