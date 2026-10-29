import { useEffect, useState } from 'react';
import { CheckCircle2, LoaderCircle, MapPin, ShieldAlert, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

type LocationState = 'checking' | 'unknown' | 'prompt' | 'granted' | 'denied' | 'error';

const permissionsAvailable = () =>
  typeof navigator !== 'undefined' && typeof navigator.permissions?.query === 'function';

export function MotoboyLocationPermission() {
  const [state, setState] = useState<LocationState>('checking');
  const [message, setMessage] = useState('Verificando permissão de localização...');
  const [requesting, setRequesting] = useState(false);

  useEffect(() => {
    let mounted = true;
    let permission: PermissionStatus | null = null;

    const update = () => {
      if (!mounted || !permission) return;
      if (permission.state === 'granted') {
        setState('granted');
        setMessage(
          'Localização autorizada neste navegador. O rastreamento ocorre somente durante a jornada de entregas.'
        );
      } else if (permission.state === 'denied') {
        setState('denied');
        setMessage(
          'Acesso bloqueado. Autorize a localização nas permissões deste site e tente novamente.'
        );
      } else {
        setState('prompt');
        setMessage('Toque no botão para solicitar a autorização de localização ao navegador.');
      }
    };

    if (!window.isSecureContext || !navigator.geolocation) {
      setState('error');
      setMessage(
        'Localização indisponível. Abra o JapanFlow por HTTPS em um navegador compatível.'
      );
    } else if (!permissionsAvailable()) {
      setState('unknown');
      setMessage(
        'Clique para verificar e solicitar a localização. Seu navegador não informa o estado da permissão antecipadamente.'
      );
    } else {
      void navigator.permissions
        .query({ name: 'geolocation' })
        .then((result) => {
          if (!mounted) return;
          permission = result;
          update();
          permission.addEventListener?.('change', update);
        })
        .catch(() => {
          if (!mounted) return;
          setState('unknown');
          setMessage('Clique para verificar e solicitar a autorização de localização.');
        });
    }

    return () => {
      mounted = false;
      permission?.removeEventListener?.('change', update);
    };
  }, []);

  const requestPermission = () => {
    if (requesting) return;
    if (!window.isSecureContext || !navigator.geolocation) {
      setState('error');
      setMessage('GPS indisponível. Verifique HTTPS, navegador e permissões do dispositivo.');
      return;
    }
    setRequesting(true);
    // A chamada ocorre diretamente no clique, para permitir o prompt nativo do navegador.
    navigator.geolocation.getCurrentPosition(
      () => {
        setRequesting(false);
        setState('granted');
        setMessage(
          'Localização autorizada! O sistema usará o GPS apenas enquanto houver uma jornada ativa.'
        );
      },
      (error) => {
        setRequesting(false);
        if (error.code === 1) {
          setState('denied');
          setMessage(
            'Permissão negada ou bloqueada. Abra as configurações deste site no navegador, permita Localização e tente novamente.'
          );
        } else {
          setState('error');
          setMessage(
            error.code === 2
              ? 'Não foi possível obter sua posição. Ative o GPS do celular e tente novamente.'
              : 'A solicitação expirou. Confira o sinal de GPS e tente novamente.'
          );
        }
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
    );
  };

  const valid = state === 'granted';
  const invalid = state === 'denied' || state === 'error';
  return (
    <section
      className="rounded-2xl border border-border/70 bg-card p-5 shadow-card"
      aria-label="Permissão de localização"
    >
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <MapPin className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold">Localização do motoboy</h2>
          <p className="text-xs text-muted-foreground">Autorização de GPS neste dispositivo</p>
        </div>
        <span
          role="status"
          aria-label={
            valid ? 'Permissão válida' : invalid ? 'Permissão inválida' : 'Permissão pendente'
          }
        >
          {valid ? (
            <CheckCircle2 className="h-6 w-6 text-green-600" />
          ) : invalid ? (
            <XCircle className="h-6 w-6 text-red-600" />
          ) : (
            <ShieldAlert className="h-6 w-6 text-muted-foreground" />
          )}
        </span>
      </div>
      <p className="mb-4 text-sm text-muted-foreground" aria-live="polite">
        {message}
      </p>
      <Button
        type="button"
        className="min-h-11 w-full sm:w-auto"
        onClick={requestPermission}
        disabled={requesting}
      >
        {requesting ? (
          <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <MapPin className="mr-2 h-4 w-4" />
        )}
        {requesting
          ? 'Verificando localização...'
          : valid
            ? 'Testar localização novamente'
            : 'Permitir localização'}
      </Button>
      <p className="mt-3 text-xs text-muted-foreground">
        A permissão é controlada pelo navegador e pode ser revogada nas configurações do site.
        Autorizar não inicia uma jornada nem compartilha sua posição fora das entregas.
      </p>
    </section>
  );
}
