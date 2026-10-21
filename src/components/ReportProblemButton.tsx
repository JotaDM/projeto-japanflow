import { useState } from 'react';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { Flag } from 'lucide-react';
import { toast } from 'sonner';
import { db } from '@/lib/firebase';
import { useApp } from '@/contexts/AppContext';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export default function ReportProblemButton() {
  const { currentUser } = useApp();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (!currentUser || message.trim().length < 10) return;
    setBusy(true);
    try {
      await addDoc(collection(db, 'user_problem_reports'), {
        user_id: currentUser.id,
        description: message.trim().slice(0, 2500),
        page: window.location.pathname,
        status: 'new',
        created_at: serverTimestamp(),
      });
      toast.success('Problema enviado para a equipe de TI');
      setMessage('');
      setOpen(false);
    } catch {
      toast.error('Não foi possível enviar o relato');
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <Button size="sm" variant="ghost" className="gap-1" onClick={() => setOpen(true)}>
        <Flag className="h-4 w-4" /> Reportar
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reportar problema</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">
            Descreva o problema. Não inclua senhas ou informações confidenciais.
          </p>
          <Textarea
            value={message}
            maxLength={2500}
            rows={5}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="O que aconteceu? Em qual etapa?"
          />
          <Button onClick={submit} disabled={busy || message.trim().length < 10}>
            {busy ? 'Enviando…' : 'Enviar relato'}
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
