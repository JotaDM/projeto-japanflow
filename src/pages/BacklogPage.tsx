import { useEffect, useMemo, useState } from 'react';
import {
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  type Timestamp,
} from 'firebase/firestore';
import { Archive, ArchiveRestore, ClipboardList, History } from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
import { db } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';

type Announcement = {
  id: string;
  title: string;
  body: string;
  image_urls?: string[];
  created_by: string;
  created_at?: Timestamp;
};
type Report = {
  id: string;
  user_id: string;
  description: string;
  page: string;
  image_urls?: string[];
  status: 'new' | 'in_progress' | 'resolved';
  archived?: boolean;
  created_at?: Timestamp;
};

export default function BacklogPage() {
  const { authenticatedUser, users } = useApp();
  const user = authenticatedUser;
  const authorized = ['ryan', 'japan-ti'].includes(user?.username?.trim().toLowerCase() || '');
  const [reports, setReports] = useState<Report[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [announcementsLoading, setAnnouncementsLoading] = useState(true);
  const [showArchived, setShowArchived] = useState(false);

  useEffect(() => {
    if (!authorized) return;
    return onSnapshot(
      query(collection(db, 'user_problem_reports'), orderBy('created_at', 'desc'), limit(250)),
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
  }, [authorized]);

  useEffect(() => {
    if (!authorized) return;
    return onSnapshot(
      query(collection(db, 'ryan_announcements'), orderBy('created_at', 'desc'), limit(100)),
      (snapshot) => {
        setAnnouncements(snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as Announcement));
        setAnnouncementsLoading(false);
      },
      (error) => {
        console.error('Avisos:', error);
        toast.error('Falha ao carregar avisos');
        setAnnouncementsLoading(false);
      }
    );
  }, [authorized]);

  const active = useMemo(
    () => reports.filter((r) => !r.archived && r.status !== 'resolved'),
    [reports]
  );
  const archived = useMemo(
    () => reports.filter((r) => r.archived || r.status === 'resolved'),
    [reports]
  );

  const update = async (report: Report, status?: Report['status'], archive?: boolean) => {
    if (!user) return;
    const nextStatus =
      status ?? (archive === false && report.status === 'resolved' ? 'in_progress' : report.status);
    const nextArchived = archive ?? (nextStatus === 'resolved' ? true : Boolean(report.archived));
    try {
      await updateDoc(doc(db, 'user_problem_reports', report.id), {
        status: nextStatus,
        archived: nextArchived,
        updated_at: serverTimestamp(),
        updated_by: user.id,
      });
      toast.success(nextArchived ? 'Relato arquivado' : 'Relato atualizado');
    } catch (error) {
      console.error(error);
      toast.error('Não foi possível atualizar o relato');
    }
  };

  if (!authorized)
    return (
      <p className="p-6 text-sm text-muted-foreground">
        Acesso restrito à equipe de administração do backlog.
      </p>
    );

  const renderReport = (r: Report) => (
    <Card key={r.id}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">
          {users.find((u) => u.id === r.user_id)?.name || r.user_id} ·{' '}
          {r.status === 'new' ? 'Novo' : r.status === 'in_progress' ? 'Em andamento' : 'Resolvido'}
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          {r.page || 'Página não informada'} ·{' '}
          {r.created_at?.toDate?.().toLocaleString('pt-BR') || 'Sem data'}
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="whitespace-pre-wrap break-words text-sm">{r.description}</p>
        {!!r.image_urls?.length && (
          <div className="flex flex-wrap gap-2">
            {r.image_urls.map((url) => (
              <a href={url} target="_blank" rel="noreferrer" key={url}>
                <img
                  src={url}
                  alt="Imagem do reporte"
                  className="h-24 w-24 rounded-md border object-cover"
                  loading="lazy"
                />
              </a>
            ))}
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          {(['new', 'in_progress', 'resolved'] as const).map((status) => (
            <Button
              key={status}
              size="sm"
              variant={r.status === status ? 'default' : 'outline'}
              onClick={() => void update(r, status, status === 'resolved')}
            >
              {status === 'new' ? 'Novo' : status === 'in_progress' ? 'Em andamento' : 'Resolvido'}
            </Button>
          ))}
          <Button
            size="sm"
            variant="outline"
            onClick={() => void update(r, undefined, !r.archived && r.status !== 'resolved')}
          >
            {r.archived || r.status === 'resolved' ? (
              <ArchiveRestore className="mr-1 h-4 w-4" />
            ) : (
              <Archive className="mr-1 h-4 w-4" />
            )}
            {r.archived || r.status === 'resolved' ? 'Restaurar' : 'Arquivar'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <section className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">Backlog</h1>
        <p className="text-sm text-muted-foreground">
          Relatos e atualizações da equipe em tempo real.
        </p>
      </div>
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <ClipboardList className="h-5 w-5" /> Backlogs ativos ({active.length})
        </h2>
        <Button size="sm" variant="outline" onClick={() => setShowArchived((v) => !v)}>
          {showArchived ? 'Ocultar arquivados' : `Arquivados (${archived.length})`}
        </Button>
      </div>
      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando relatos...</p>
      ) : active.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum backlog ativo.</p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">{active.map(renderReport)}</div>
      )}
      {showArchived && (
        <div className="space-y-3">
          <h3 className="font-medium">Backlogs arquivados</h3>
          <div className="grid gap-3 md:grid-cols-2">{archived.map(renderReport)}</div>
          {!archived.length && (
            <p className="text-sm text-muted-foreground">Nenhum item arquivado.</p>
          )}
        </div>
      )}
      <Separator className="my-6" />
      <div>
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <History className="h-5 w-5" /> Registros de atualização
        </h2>
        <p className="text-xs text-muted-foreground">
          Comunicados publicados para a equipe, do mais recente ao mais antigo.
        </p>
      </div>
      {announcementsLoading && (
        <p className="text-sm text-muted-foreground">Carregando atualizações...</p>
      )}
      {!announcementsLoading && !announcements.length && (
        <p className="text-sm text-muted-foreground">Nenhum aviso publicado.</p>
      )}
      <div className="grid gap-3 md:grid-cols-2">
        {announcements.map((notice) => (
          <Card key={notice.id}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">{notice.title}</CardTitle>
              <p className="text-xs text-muted-foreground">
                {notice.created_at?.toDate?.().toLocaleString('pt-BR') || 'Sem data'} ·{' '}
                {users.find((u) => u.id === notice.created_by)?.name || 'Ryan'}
              </p>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="whitespace-pre-wrap break-words text-sm">{notice.body}</p>
              {!!notice.image_urls?.length && (
                <div className="flex flex-wrap gap-2">
                  {notice.image_urls.map((url) => (
                    <a href={url} target="_blank" rel="noreferrer" key={url}>
                      <img
                        src={url}
                        alt="Imagem do aviso"
                        className="h-24 w-24 rounded-md border object-cover"
                        loading="lazy"
                      />
                    </a>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}
