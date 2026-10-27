import { useEffect, useState } from 'react';
import {
  collection,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { useApp } from '@/contexts/AppContext';
import { db } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';

interface Reply {
  id: string;
  report_id: string;
  recipient_id: string;
  body: string;
  reaction: string | null;
}
const EMOJIS = ['👍', '❤️', '🙏', '✅', '😊'] as const;

export default function BacklogReplyPopup() {
  const { authenticatedUser } = useApp();
  const [replies, setReplies] = useState<Reply[]>([]);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (!authenticatedUser?.id) {
      setReplies([]);
      return;
    }
    return onSnapshot(
      query(collection(db, 'backlog_responses'), where('recipient_id', '==', authenticatedUser.id)),
      (snapshot) =>
        setReplies(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as Reply)),
      (error) => console.error('Falha ao carregar respostas de backlog:', error)
    );
  }, [authenticatedUser?.id]);
  const pending = replies.filter((item) => !item.reaction).sort((a, b) => a.id.localeCompare(b.id));
  const active = pending[0];
  const acknowledge = async (emoji: string) => {
    if (!active || saving) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, 'backlog_responses', active.id), {
        reaction: emoji,
        reacted_at: serverTimestamp(),
      });
      toast.success('Leitura confirmada');
    } catch (error) {
      console.error(error);
      toast.error('Falha ao confirmar a leitura');
    } finally {
      setSaving(false);
    }
  };
  return (
    <Dialog open={Boolean(active)} onOpenChange={() => undefined}>
      <DialogContent
        className="max-w-md"
        onEscapeKeyDown={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Resposta ao seu reporte</DialogTitle>
          <DialogDescription>
            Escolha uma reação para confirmar que leu a resposta.
          </DialogDescription>
        </DialogHeader>
        <div className="rounded-lg border bg-muted/40 p-4 text-sm whitespace-pre-wrap break-words">
          {active?.body}
        </div>
        <div className="flex justify-center gap-2">
          {EMOJIS.map((emoji) => (
            <Button
              key={emoji}
              disabled={saving}
              type="button"
              variant="outline"
              className="text-lg hover:scale-110 transition-transform"
              onClick={() => void acknowledge(emoji)}
            >
              {emoji}
            </Button>
          ))}
        </div>
        {pending.length > 1 && (
          <p className="text-center text-xs text-muted-foreground">
            Mais {pending.length - 1} resposta(s) aguardando leitura.
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
