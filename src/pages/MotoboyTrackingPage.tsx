import { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { Link, Navigate } from 'react-router-dom';
import { ArrowLeft, Clock3, LocateFixed, MapPin, ShieldCheck, Truck } from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
import { db } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

type Session = {
  id: string;
  userId: string;
  phase: 'delivering' | 'returning';
  lat: number | null;
  lng: number | null;
  accuracy: number | null;
  updatedAt: number;
};

const MAX_AGE_MS = 120_000;

/** Cada iframe utiliza apenas a coordenada recente do proprio motoboy. */
function IndividualMap({ session, name, now }: { session: Session; name: string; now: number }) {
  const valid =
    session.lat !== null &&
    session.lng !== null &&
    Number.isFinite(session.lat) &&
    Number.isFinite(session.lng) &&
    session.lat >= -90 &&
    session.lat <= 90 &&
    session.lng >= -180 &&
    session.lng <= 180;
  const recent =
    valid &&
    session.updatedAt > 0 &&
    now - session.updatedAt >= 0 &&
    now - session.updatedAt <= MAX_AGE_MS;
  const bbox = recent
    ? [session.lng! - 0.012, session.lat! - 0.008, session.lng! + 0.012, session.lat! + 0.008].join(
        ','
      )
    : '';
  const url = recent
    ? `https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(bbox)}&layer=mapnik&marker=${encodeURIComponent(`${session.lat},${session.lng}`)}`
    : '';
  return (
    <article className="min-w-0 overflow-hidden rounded-2xl border bg-card shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3 p-4">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 font-semibold">
            <Truck className="h-4 w-4 text-primary" /> {name}
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {session.phase === 'returning' ? 'Retornando à loja' : 'Em entregas'}
          </p>
        </div>
        <Badge variant={recent ? 'default' : 'secondary'}>
          {recent ? 'Localização recente' : 'Sinal indisponível'}
        </Badge>
      </div>
      {recent ? (
        <iframe
          title={`Mapa individual de ${name}`}
          className="h-72 w-full border-y sm:h-80"
          loading="lazy"
          referrerPolicy="no-referrer"
          src={url}
        />
      ) : (
        <div className="flex h-72 flex-col items-center justify-center gap-2 border-y bg-muted/30 px-5 text-center text-muted-foreground sm:h-80">
          <MapPin className="h-8 w-8" />
          <p className="text-sm font-medium">Sem posição recente</p>
          <p className="max-w-xs text-xs">
            A jornada pode estar sem permissão de GPS, com o aparelho offline ou com o navegador
            suspenso.
          </p>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 p-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <Clock3 className="h-3.5 w-3.5" />{' '}
          {session.updatedAt
            ? new Date(session.updatedAt).toLocaleString('pt-BR')
            : 'Aguardando primeira posição'}
        </span>
        {recent && session.accuracy !== null && (
          <span className="flex items-center gap-1">
            <LocateFixed className="h-3.5 w-3.5" /> Precisão aproximada:{' '}
            {Math.round(session.accuracy)} m
          </span>
        )}
      </div>
    </article>
  );
}

export default function MotoboyTrackingPage() {
  const { currentUser, users } = useApp();
  const authorized = currentUser?.role === 'admin' || currentUser?.id === 'emp-1';
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!authorized) return;
    const unsubscribe = onSnapshot(
      collection(db, 'motoboy_live_sessions'),
      (snapshot) => {
        setSessions(
          snapshot.docs.map((docSnap) => {
            const data = docSnap.data();
            return {
              id: docSnap.id,
              userId: String(data.user_id || docSnap.id),
              phase: data.phase === 'returning' ? 'returning' : 'delivering',
              lat: typeof data.lat === 'number' ? data.lat : null,
              lng: typeof data.lng === 'number' ? data.lng : null,
              accuracy: typeof data.accuracy === 'number' ? data.accuracy : null,
              updatedAt: data.updated_at?.toMillis?.() || 0,
            };
          })
        );
        setError(null);
        setLoading(false);
      },
      () => {
        setError('Não foi possível consultar as jornadas. Verifique as permissões do Firestore.');
        setLoading(false);
        setSessions([]);
      }
    );
    return unsubscribe;
  }, [authorized]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 15_000);
    return () => window.clearInterval(timer);
  }, []);

  const sorted = useMemo(
    () => [...sessions].sort((a, b) => a.userId.localeCompare(b.userId)),
    [sessions]
  );
  if (!currentUser) return <Navigate to="/login" replace />;
  if (!authorized)
    return (
      <div role="alert" className="rounded-xl border p-6">
        Acesso restrito à gestão autorizada dos motoboys.
      </div>
    );
  const getName = (id: string) => users.find((user) => user.id === id)?.name || id;

  return (
    <main className="space-y-6 pb-8">
      <header className="rounded-2xl border bg-card p-5 sm:p-6">
        <Button asChild variant="ghost" size="sm" className="mb-4">
          <Link to="/departmental">
            <ArrowLeft className="mr-2 h-4 w-4" /> Voltar ao Departamental
          </Link>
        </Button>
        <div className="flex items-center gap-3">
          <MapPin className="h-7 w-7 text-primary" />
          <div>
            <h1 className="text-2xl font-semibold">Acompanhamento dos motoboys</h1>
            <p className="text-sm text-muted-foreground">
              Uma visualização individual por jornada ativa, atualizada pelo Firestore.
            </p>
          </div>
        </div>
        <p className="mt-3 flex items-start gap-2 text-xs text-muted-foreground">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" /> Somente a gestão autorizada acessa
          estes dados. Mapas externos OpenStreetMap recebem as coordenadas de cada posição exibida.
          O navegador móvel pode suspender atualizações em segundo plano.
        </p>
      </header>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border bg-card p-4">
          <p className="text-xs text-muted-foreground">Jornadas registradas</p>
          <strong className="text-2xl">{sessions.length}</strong>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <p className="text-xs text-muted-foreground">Em entregas</p>
          <strong className="text-2xl">
            {sessions.filter((s) => s.phase === 'delivering').length}
          </strong>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <p className="text-xs text-muted-foreground">Retornando à loja</p>
          <strong className="text-2xl">
            {sessions.filter((s) => s.phase === 'returning').length}
          </strong>
        </div>
      </div>
      {error && (
        <div
          role="alert"
          className="rounded-xl border border-destructive p-4 text-sm text-destructive"
        >
          {error}
        </div>
      )}
      {loading ? (
        <p className="text-sm text-muted-foreground">Consultando jornadas...</p>
      ) : sorted.length === 0 && !error ? (
        <div className="rounded-xl border p-10 text-center text-sm text-muted-foreground">
          Nenhum motoboy com jornada registrada no momento.
        </div>
      ) : null}
      <section className="grid gap-5 lg:grid-cols-2" aria-label="Mapas individuais dos motoboys">
        {sorted.map((s) => (
          <IndividualMap key={s.id} session={s} name={getName(s.userId)} now={now} />
        ))}
      </section>
    </main>
  );
}
