import { useState } from 'react';
import { collection, doc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { Flag, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { db } from '@/lib/firebase';
import { uploadImage } from '@/lib/uploadImage';
import { useApp } from '@/contexts/AppContext';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

type Draft = { id: number; message: string; files: File[] };
const empty = (id: number): Draft => ({ id, message: '', files: [] });
export default function ReportProblemButton() {
  const { currentUser } = useApp();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Draft[]>([empty(0)]);
  const [busy, setBusy] = useState(false);
  const valid = items.length > 0 && items.every((item) => item.message.trim().length >= 10);
  const edit = (id: number, update: Partial<Draft>) =>
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...update } : i)));
  const submit = async () => {
    if (!currentUser || !valid || busy) return;
    setBusy(true);
    try {
      const batch = writeBatch(db);
      for (const item of items) {
        const ref = doc(collection(db, 'user_problem_reports'));
        const urls: string[] = [];
        for (const file of item.files) {
          if (!file.type.startsWith('image/')) throw new Error('Apenas imagens são permitidas');
          const uploaded = await uploadImage(file, {
            pathPrefix: 'backlog-reports',
            sourceTable: 'user_problem_reports',
            sourceId: ref.id,
            sourceField: 'image_urls',
            uploadedBy: currentUser.id,
          });
          urls.push(uploaded.publicUrl);
        }
        batch.set(ref, {
          user_id: currentUser.id,
          description: item.message.trim().slice(0, 2500),
          page: window.location.pathname,
          status: 'new',
          archived: false,
          image_urls: urls,
          created_at: serverTimestamp(),
        });
      }
      await batch.commit();
      toast.success(`${items.length} relato(s) enviado(s) para a equipe de TI`);
      setItems([empty(0)]);
      setOpen(false);
    } catch (error) {
      console.error(error);
      toast.error('Não foi possível enviar os relatos; confira os anexos e tente novamente');
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <Button size="sm" variant="ghost" className="gap-1" onClick={() => setOpen(true)}>
        <Flag className="h-4 w-4" /> Reportar
      </Button>
      <Dialog
        open={open}
        onOpenChange={(value) => {
          if (!busy) setOpen(value);
        }}
      >
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Reportar problemas</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">
            Adicione um ou vários reportes e envie todos juntos. Não informe senhas ou dados
            confidenciais.
          </p>
          <div className="space-y-4">
            {items.map((item, index) => (
              <div key={item.id} className="space-y-2 rounded-lg border p-3">
                <div className="flex items-center justify-between">
                  <strong className="text-sm">Reporte {index + 1}</strong>
                  {items.length > 1 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={busy}
                      onClick={() => setItems((prev) => prev.filter((x) => x.id !== item.id))}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                <Textarea
                  value={item.message}
                  maxLength={2500}
                  rows={4}
                  onChange={(e) => edit(item.id, { message: e.target.value })}
                  placeholder="O que aconteceu? Em qual etapa?"
                />
                <label className="block text-xs text-muted-foreground">
                  Anexar imagens (até 5 por reporte)
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    disabled={busy}
                    className="mt-1 block w-full text-xs"
                    onChange={(e) => {
                      const files = [...item.files, ...Array.from(e.target.files || [])].slice(
                        0,
                        5
                      );
                      edit(item.id, { files });
                      e.target.value = '';
                    }}
                  />
                </label>
                {!!item.files.length && (
                  <p className="text-xs text-muted-foreground">
                    {item.files.map((f) => f.name).join(', ')}{' '}
                    <button
                      type="button"
                      className="underline"
                      onClick={() => edit(item.id, { files: [] })}
                    >
                      Limpar
                    </button>
                  </p>
                )}
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              disabled={busy || items.length >= 20}
              onClick={() =>
                setItems((prev) => [...prev, empty(Math.max(0, ...prev.map((i) => i.id)) + 1)])
              }
            >
              <Plus className="mr-1 h-4 w-4" /> Adicionar reporte
            </Button>
            <Button disabled={busy || !valid} onClick={() => void submit()}>
              {busy ? 'Enviando...' : `Enviar ${items.length} reporte(s)`}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
