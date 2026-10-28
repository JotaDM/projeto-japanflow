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
      className="mt-12 w-full border-t border-border/60 bg-background/70 px-1 py-5 text-xs text-muted-foreground"
      aria-label="Rodapé do sistema"
    >
      <div className="flex w-full flex-col items-start gap-1.5 text-left leading-relaxed">
        <span className="inline-flex items-center gap-2 font-medium text-foreground">
          <span aria-hidden="true" className="h-2 w-2 rounded-full bg-emerald-500" />
          JapanFlow
        </span>
        <span className="break-words">{message}</span>
        <span className="opacity-75">
          © {new Date().getFullYear()} Japan Imports · Ambiente interno
        </span>
      </div>
    </footer>
  );
}
