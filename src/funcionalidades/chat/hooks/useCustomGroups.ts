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
  where,
} from 'firebase/firestore';

import { useApp } from '@/contexts/AppContext';

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
  const { authenticatedUser } = useApp();
  const authenticatedUserId = authenticatedUser?.id ?? null;

  useEffect(() => {
    if (!authenticatedUserId) {
      setGroups([]);
      return;
    }

    const groupsQuery = query(
      collection(db, 'custom_groups'),
      where('participant_ids', 'array-contains', authenticatedUserId)
    );

    return onSnapshot(
      groupsQuery,
      (snapshot) => {
        const result = snapshot.docs.map((groupDoc) => {
          const data = groupDoc.data();

          return {
            id: groupDoc.id,
            name: data.name || '',
            createdBy: data.created_by || '',
            participants: Array.isArray(data.participants) ? data.participants : [],
            participantIds: Array.isArray(data.participant_ids) ? data.participant_ids : [],
            createdAt: toIso(data.created_at),
          };
        });

        result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

        setGroups(result);
      },
      (error) => {
        console.error('Erro ao carregar grupos:', error);
        setGroups([]);
      }
    );
  }, [authenticatedUserId]);

  const createGroup = useCallback(
    async (name: string, participants: string[], createdBy: string) => {
      const usersSnapshot = await getDocs(collection(db, 'users'));

      const users = usersSnapshot.docs.map((userDoc) => ({
        id: userDoc.id,
        username: String(userDoc.data().username || '').trim(),
        active: userDoc.data().active !== false,
      }));

      if (!authenticatedUserId) {
        throw new Error('Usuário não autenticado');
      }

      if (createdBy !== authenticatedUserId) {
        throw new Error('O criador do grupo deve ser o usuário autenticado');
      }

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
    [authenticatedUserId]
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
