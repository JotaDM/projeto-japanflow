import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';

import { db } from '@/lib/firebase';

export type CostGuardMode = 'normal' | 'warning' | 'economy' | 'protected';

export interface CostGuardState {
  mode: CostGuardMode;
  maxPercentage: number;
  readsPercentage: number;
  writesPercentage: number;
  deletesPercentage: number;
  status: 'loading' | 'ready' | 'unavailable';
  lastUpdated: Date | null;
  day: string | null;
}

const DEFAULT_STATE: CostGuardState = {
  mode: 'normal',
  maxPercentage: 0,
  readsPercentage: 0,
  writesPercentage: 0,
  deletesPercentage: 0,
  status: 'loading',
  lastUpdated: null,
  day: null,
};

export function useCostGuard(enabled = true) {
  const [state, setState] = useState<CostGuardState>(DEFAULT_STATE);

  useEffect(() => {
    if (!enabled) {
      setState(DEFAULT_STATE);
      return;
    }

    const guardRef = doc(db, 'system_runtime', 'firestore_guard');

    return onSnapshot(
      guardRef,
      (snapshot) => {
        if (!snapshot.exists()) {
          setState({ ...DEFAULT_STATE, status: 'unavailable' });
          return;
        }

        const data = snapshot.data();

        const rawMode = String(data.mode || 'normal');

        const mode: CostGuardMode =
          rawMode === 'warning' || rawMode === 'economy' || rawMode === 'protected'
            ? rawMode
            : 'normal';

        setState({
          mode,
          maxPercentage: Number(data.max_percentage || 0),
          readsPercentage: Number(data.reads_percentage || 0),
          writesPercentage: Number(data.writes_percentage || 0),
          deletesPercentage: Number(data.deletes_percentage || 0),
          status: 'ready',
          lastUpdated: data.updated_at?.toDate?.() ?? null,
          day: typeof data.day === 'string' ? data.day : null,
        });
      },
      (error) => {
        console.warn('Não foi possível carregar o Cost Guard:', error);

        setState({ ...DEFAULT_STATE, status: 'unavailable' });
      }
    );
  }, [enabled]);

  return state;
}
