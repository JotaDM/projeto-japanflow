import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, Timestamp, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
const formatter = new Intl.DateTimeFormat('en-CA', {timeZone:'America/Sao_Paulo', year:'numeric',month:'2-digit',day:'2-digit'});
const today = () => formatter.format(new Date());
// São Paulo permanece UTC-3 em 2026. Caso a legislação de fuso mude, rever este limite.
function bounds(key: string) {
  const start = Timestamp.fromDate(new Date(`${key}T03:00:00.000Z`));
  return { start, end: Timestamp.fromMillis(start.toMillis() + 86_400_000) };
}
export function useDailyCompletedCount(userId?: string) {
  const [dateKey, setDateKey] = useState(today);
  const [count, setCount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const refresh = () => setDateKey(today());
    const interval = window.setInterval(refresh, 60_000);
    document.addEventListener('visibilitychange', refresh);
    return () => { window.clearInterval(interval); document.removeEventListener('visibilitychange', refresh); };
  }, []);
  useEffect(() => {
    setCount(null); setError(null);
    const {start, end} = bounds(dateKey);
    const q = query(collection(db,'tasks'), where('completed_at','>=',start), where('completed_at','<',end));
    return onSnapshot(q, (snapshot) => {
      setCount(snapshot.docs.filter((doc) => {
        const d = doc.data();
        if (d.status !== 'done') return false;
        if (!userId) return true;
        return d.assignee_id === userId || (Array.isArray(d.assignee_ids) && d.assignee_ids.includes(userId));
      }).length);
    }, (cause) => { setError(cause.message); setCount(null); });
  }, [dateKey, userId]);
  return { count, error };
}
