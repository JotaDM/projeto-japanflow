import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';

// O texto continua editavel no documento app_settings/system_footer.
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
        console.warn('Rodape indisponivel:', error);
        setMessage(DEFAULT_FOOTER);
      }
    );
  }, []);

  return (
    <footer
      className="mt-8 w-full border-t border-border/60 bg-transparent px-4 py-3 text-xs text-muted-foreground"
      aria-label="Rodape do sistema"
    >
      <div className="mx-auto flex w-full min-w-0 flex-col items-center justify-center gap-1 text-center">
        <span
          className="relative inline-flex h-24 w-24 shrink-0 items-center justify-center"
          aria-hidden="true"
        >
          <img
            src="/branding/japanflow-footer-light.svg"
            alt=""
            className="jf-footer-logo-light h-24 w-24 object-contain"
            loading="lazy"
          />
          <img
            src="/branding/japanflow-footer-dark.svg"
            alt=""
            className="jf-footer-logo-dark hidden h-24 w-24 object-contain"
            loading="lazy"
          />
        </span>
        <span className="min-w-0 break-words leading-relaxed">{message}</span>
      </div>
    </footer>
  );
}
