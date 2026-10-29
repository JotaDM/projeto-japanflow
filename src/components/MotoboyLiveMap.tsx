import { useEffect, useMemo, useState } from 'react';
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { MapPin, Navigation, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import type { MotoboyAssignment } from '@/hooks/useDepartmental';

type Location = {
  rideId: string;
  userId: string;
  lat: number;
  lng: number;
  accuracy: number;
  updatedAt: number;
};

/** Rastreamento operacional durante a jornada de entregas iniciada pelo motoboy.
 * A primeira corrida iniciada abre a jornada; apos a ultima entrega, aguarda
 * confirmacao de chegada a loja. O navegador exige permissao de GPS e pode
 * suspender a coleta se o aplicativo for fechado ou colocado em segundo plano.
 */
export function MotoboyLocationSharing({
  userId,
  assignments,
}: {
  userId: string;
  assignments: MotoboyAssignment[];
}) {
  const [session, setSession] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const activeRides = assignments.filter(
    (ride) => ride.assignedTo === userId && ride.status === 'accepted'
  );
  const hasActiveRides = activeRides.length > 0;
  const reference = useMemo(() => doc(db, 'motoboy_live_sessions', userId), [userId]);

  // Uma jornada iniciada permanece ativa apos a ultima entrega, ate o retorno.
  useEffect(() => {
    return onSnapshot(
      reference,
      (snapshot) => setSession(snapshot.exists()),
      () => setGpsError('Nao foi possivel consultar a jornada.')
    );
  }, [reference]);

  useEffect(() => {
    if (!hasActiveRides || session) return;
    // O aplicativo so inicia a jornada quando o motoboy inicia uma corrida.
    void setDoc(
      reference,
      { user_id: userId, phase: 'delivering', updated_at: serverTimestamp() },
      { merge: true }
    ).catch(() => setGpsError('Nao foi possivel iniciar o rastreamento.'));
  }, [reference, userId, hasActiveRides, session]);

  useEffect(() => {
    if (!session) return;
    if (!navigator.geolocation) {
      setGpsError('GPS indisponivel neste aparelho.');
      return;
    }
    let last = 0;
    const watch = navigator.geolocation.watchPosition(
      (position) => {
        if (Date.now() - last < 15000) return;
        last = Date.now();
        void setDoc(
          reference,
          {
            user_id: userId,
            phase: hasActiveRides ? 'delivering' : 'returning',
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracy: position.coords.accuracy,
            updated_at: serverTimestamp(),
          },
          { merge: true }
        )
          .then(() => setGpsError(null))
          .catch(() => setGpsError('Falha ao atualizar a localizacao.'));
      },
      () => setGpsError('Permita acesso a localizacao no navegador para acompanhar a jornada.'),
      { enableHighAccuracy: true, maximumAge: 15000, timeout: 20000 }
    );
    return () => navigator.geolocation.clearWatch(watch);
  }, [reference, session, userId, hasActiveRides]);

  if (!session && !hasActiveRides) return null;
  return (
    <div className="rounded-xl border bg-card p-3 text-sm" role="status">
      <div className="mb-2 flex items-center gap-2 font-semibold">
        <Navigation className="h-4 w-4" /> Localizacao durante entregas
      </div>
      <p className="text-xs text-muted-foreground">
        {hasActiveRides
          ? `Jornada em andamento: ${activeRides.length} corrida(s) iniciada(s). A localizacao e compartilhada com a gestao autorizada.`
          : 'Entregas concluidas. O compartilhamento permanece durante o retorno a loja.'}
      </p>
      {gpsError && <p className="mt-2 text-xs text-destructive">{gpsError}</p>}
      {session && !hasActiveRides && (
        <Button
          type="button"
          size="sm"
          className="mt-3 min-h-11 w-full sm:w-auto"
          onClick={async () => {
            try {
              await deleteDoc(reference);
              toast.success('Retorno a loja confirmado. Jornada encerrada.');
            } catch {
              toast.error('Nao foi possivel encerrar a jornada. Tente novamente.');
            }
          }}
        >
          Confirmar chegada a loja
        </Button>
      )}
      <p className="mt-2 text-[11px] text-muted-foreground">
        O rastreamento depende da permissao do aparelho e pode ser interrompido pelo sistema
        operacional em segundo plano.
      </p>
    </div>
  );
}

export function MotoboyLiveMap({
  open,
  onOpenChange,
  getName,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  getName: (id: string) => string;
}) {
  const [locations, setLocations] = useState<Location[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [, forceClock] = useState(0);
  useEffect(() => {
    if (!open) return;
    const t = window.setInterval(() => forceClock((v) => v + 1), 20000);
    return () => window.clearInterval(t);
  }, [open]);
  useEffect(() => {
    if (!open) return;
    return onSnapshot(
      collection(db, 'motoboy_live_sessions'),
      (snap) => {
        setLocations(
          snap.docs.map((row) => {
            const d = row.data();
            return {
              rideId: row.id,
              userId: d.user_id || '',
              lat: d.lat,
              lng: d.lng,
              accuracy: d.accuracy || 0,
              updatedAt: d.updated_at?.toMillis?.() || 0,
            };
          })
        );
      },
      () => toast.error('Sem permissão para visualizar o GPS dos motoboys.')
    );
  }, [open]);
  const recent = locations.filter(
    (p) => Number.isFinite(p.lat) && Number.isFinite(p.lng) && Date.now() - p.updatedAt < 120000
  );
  const point = recent.find((p) => p.rideId === selected) || recent[0];
  const bbox = point
    ? `${point.lng - 0.012}%2C${point.lat - 0.008}%2C${point.lng + 0.012}%2C${point.lat + 0.008}`
    : '';
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="h-4 w-4" /> Mapa de motoboys
          </DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground">
          <ShieldCheck className="mr-1 inline h-3 w-3" /> Posicoes recentes de jornadas de entrega,
          incluindo o retorno a loja. Ao abrir o mapa, a localização selecionada é compartilhada com
          OpenStreetMap.
        </p>
        {recent.length ? (
          <>
            <div className="flex flex-wrap gap-2">
              {recent.map((p) => (
                <Button
                  size="sm"
                  key={p.rideId}
                  variant={point?.rideId === p.rideId ? 'default' : 'outline'}
                  onClick={() => setSelected(p.rideId)}
                >
                  {getName(p.userId)} ·{' '}
                  {new Date(p.updatedAt).toLocaleTimeString('pt-BR', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </Button>
              ))}
            </div>
            {point && (
              <iframe
                title={`Mapa do motoboy ${getName(point.userId)}`}
                className="h-[min(55vh,490px)] w-full rounded-xl border"
                loading="lazy"
                referrerPolicy="no-referrer"
                src={`https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${point.lat}%2C${point.lng}`}
              />
            )}
          </>
        ) : (
          <p className="rounded-xl border p-6 text-center text-sm text-muted-foreground">
            Nenhuma localizacao recente disponivel.
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
