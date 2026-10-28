import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';

const DEFAULT_FOOTER = 'JapanFlow · Japan Imports';

export default function SystemFooter() {
  const [message, setMessage] = useState(DEFAULT_FOOTER);

  useEffect(() => {
    return onSnapshot(
      doc(db, 'app_settings', 'system_footer'),
      (snapshot) => {
        const value = snapshot.data()?.message;
        setMessage(typeof value === 'string' && value.trim() ? value.trim() : DEFAULT_FOOTER);
      },
      (error) => {
        console.warn('Rodapé indisponível:', error);
        setMessage(DEFAULT_FOOTER);
      }
    );
  }, []);

  return (
    <footer
      className="mt-10 border-t border-border/60 bg-card/70 px-5 py-5 text-xs text-muted-foreground"
      aria-label="Rodapé do sistema"
    >
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 text-center sm:flex-row sm:text-left">
        <div className="flex items-center gap-2">
          <span aria-hidden="true" className="h-2 w-2 rounded-full bg-emerald-500" />
          <span className="font-semibold text-foreground">JapanFlow</span>
          <span className="text-border">·</span>
          <span>{message}</span>
        </div>
        <span>© {new Date().getFullYear()} Japan Imports · Ambiente interno</span>
      </div>
    </footer>
  );
}
