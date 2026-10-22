import { useEffect, useState } from 'react';
import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';
import { Megaphone } from 'lucide-react';
import { toast } from 'sonner';
import { useApp } from '@/contexts/AppContext';
import { db } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

type Announcement = { id: string; title: string; body: string; created_by: string };

export default function RyanAnnouncements() {
  const { authenticatedUser } = useApp();
  const [items, setItems] = useState<Announcement[]>([]);
  const [seen, setSeen] = useState<Set<string>>(new Set());
  const [loaded, setLoaded] = useState(false);
  const [composer, setComposer] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const isRyan = authenticatedUser?.username?.trim().toLowerCase() === 'ryan';
  const uid = authenticatedUser?.id;

  useEffect(() => {
    if (!uid) return;
    setLoaded(false);
    setSeen(new Set());
    const unsub = onSnapshot(
      collection(db, 'ryan_announcement_acks'),
      (snap) => {
        setSeen(
          new Set(
            snap.docs
              .filter((d) => d.data().user_id === uid)
              .map((d) => String(d.data().announcement_id))
          )
        );
        setLoaded(true);
      },
      (e) => console.warn('Avisos: falha ao buscar confirmações', e)
    );
    return unsub;
  }, [uid]);

  useEffect(() => {
    if (!uid) return;
    return onSnapshot(
      query(collection(db, 'ryan_announcements'), orderBy('created_at', 'asc')),
      (snap) => {
        setItems(
          snap.docs.map((d) => ({
            id: d.id,
            title: String(d.data().title || ''),
            body: String(d.data().body || ''),
            created_by: String(d.data().created_by || ''),
          }))
        );
      },
      (e) => console.warn('Avisos: falha ao buscar anúncios', e)
    );
  }, [uid]);

  const current = loaded ? items.find((x) => !seen.has(x.id)) : undefined;
  const acknowledge = async () => {
    if (!current || !uid) return;
    try {
      await setDoc(doc(db, 'ryan_announcement_acks', `${current.id}_${uid}`), {
        announcement_id: current.id,
        user_id: uid,
        acknowledged_at: serverTimestamp(),
      });
    } catch {
      toast.error('Não foi possível confirmar o aviso');
    }
  };
  const publish = async () => {
    if (!uid || !isRyan || !title.trim() || !body.trim()) return;
    setSending(true);
    try {
      await addDoc(collection(db, 'ryan_announcements'), {
        title: title.trim().slice(0, 120),
        body: body.trim().slice(0, 3000),
        created_by: uid,
        created_at: serverTimestamp(),
      });
      toast.success('Aviso publicado para toda a equipe');
      setComposer(false);
      setTitle('');
      setBody('');
    } catch {
      toast.error('Erro ao publicar o aviso');
    } finally {
      setSending(false);
    }
  };
  return (
    <>
      {isRyan && (
        <Button size="sm" variant="outline" className="gap-2" onClick={() => setComposer(true)}>
          <Megaphone className="h-4 w-4" /> Avisar equipe
        </Button>
      )}
      <Dialog open={composer} onOpenChange={setComposer}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enviar aviso para todos</DialogTitle>
          </DialogHeader>
          <Input
            aria-label="Título do aviso"
            value={title}
            maxLength={120}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Título da atualização"
          />
          <Textarea
            aria-label="Mensagem do aviso"
            value={body}
            maxLength={3000}
            onChange={(e) => setBody(e.target.value)}
            rows={5}
            placeholder="O que mudou no sistema?"
          />
          <Button disabled={sending || !title.trim() || !body.trim()} onClick={publish}>
            {sending ? 'Enviando…' : 'Publicar aviso'}
          </Button>
        </DialogContent>
      </Dialog>
      <Dialog open={Boolean(current)} onOpenChange={() => {}}>
        <DialogContent
          onEscapeKeyDown={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>{current?.title || 'Atualização do JapanFlow'}</DialogTitle>
          </DialogHeader>
          <p className="whitespace-pre-wrap break-words text-sm">{current?.body}</p>
          <Button onClick={acknowledge}>Entendi</Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
