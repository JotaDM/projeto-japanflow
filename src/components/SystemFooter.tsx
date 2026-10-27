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
      className="shrink-0 border-t border-border/60 bg-background px-4 py-2 text-center text-xs text-muted-foreground"
      aria-label="Rodapé do sistema"
    >
      <p className="break-words">{message}</p>
    </footer>
  );
}
