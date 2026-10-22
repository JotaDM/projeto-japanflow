import { useEffect, useState } from 'react';
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  Timestamp,
  updateDoc,
} from 'firebase/firestore';
import { useApp } from '@/contexts/AppContext';
import { db } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';

type Report = {
  id: string;
  user_id: string;
  description: string;
  page: string;
  status: string;
  created_at?: Timestamp;
};

export default function BacklogPage() {
  const { authenticatedUser, users } = useApp();
  const user = authenticatedUser;
  const authorized =
    user?.username?.trim().toLowerCase() === 'ryan' ||
    user?.username?.trim().toLowerCase() === 'japan-ti';
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authorized) return;
    const unsubscribe = onSnapshot(
      query(collection(db, 'user_problem_reports'), orderBy('created_at', 'desc')),
      (snapshot) => {
        setReports(snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as Report));
        setLoading(false);
      },
      (error) => {
        console.error('Backlog:', error);
        toast.error('Falha ao carregar o backlog');
        setLoading(false);
      }
    );
    return unsubscribe;
  }, [authorized]);

  if (!authorized)
    return <p className="p-6 text-sm text-muted-foreground">Acesso restrito ao Ryan e Japan-TI.</p>;

  const update = async (id: string, status: 'new' | 'in_progress' | 'resolved') => {
    if (!user) return;
    try {
      await updateDoc(doc(db, 'user_problem_reports', id), {
        status,
        updated_at: Timestamp.now(),
        updated_by: user.id,
      });
      toast.success('Relato atualizado');
    } catch (error) {
      console.error(error);
      toast.error('Não foi possível alterar o relato');
    }
  };

  return (
    <section className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Backlog</h1>
        <p className="text-sm text-muted-foreground">
          Problemas reportados pela equipe, atualizados em tempo real.
        </p>
      </div>
      {loading && <p className="text-sm text-muted-foreground">Carregando relatos...</p>}
      {!loading && reports.length === 0 && (
        <p className="text-sm text-muted-foreground">Nenhum problema reportado.</p>
      )}
      <div className="grid gap-3">
        {reports.map((report) => (
          <Card key={report.id}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">
                {users.find((u) => u.id === report.user_id)?.name || report.user_id}
                {' · '}
                {report.status === 'new'
                  ? 'Novo'
                  : report.status === 'in_progress'
                    ? 'Em andamento'
                    : 'Resolvido'}
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                {report.page || 'Página não informada'}
                {' · '}
                {report.created_at?.toDate?.().toLocaleString('pt-BR') || 'Sem data'}
              </p>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="whitespace-pre-wrap break-words text-sm">{report.description}</p>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant={report.status === 'new' ? 'default' : 'outline'}
                  onClick={() => void update(report.id, 'new')}
                >
                  Novo
                </Button>
                <Button
                  size="sm"
                  variant={report.status === 'in_progress' ? 'default' : 'outline'}
                  onClick={() => void update(report.id, 'in_progress')}
                >
                  Em andamento
                </Button>
                <Button
                  size="sm"
                  variant={report.status === 'resolved' ? 'default' : 'outline'}
                  onClick={() => void update(report.id, 'resolved')}
                >
                  Resolvido
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}
