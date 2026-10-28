import { useEffect, useState } from 'react';
import { getBlob, ref } from 'firebase/storage';
import { storage } from '@/lib/firebase';
import type { WarrantyClaim } from '@/hooks/useWarranties';

function SiteAttachment({ file }: { file: NonNullable<WarrantyClaim['siteAttachments']>[number] }) {
  const [url, setUrl] = useState('');
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [imageFailed, setImageFailed] = useState(false);
  useEffect(() => {
    let alive = true;
    let objectUrl = '';
    setUrl('');
    setFailed(false);
    setImageFailed(false);
    if (!/^attachments\/warranties\/site\/[a-f0-9-]{36}\/[a-f0-9]{64}\/[0-4]$/.test(file.path)) {
      setFailed(true);
      return;
    }
    getBlob(ref(storage, file.path), 10 * 1024 * 1024)
      .then((blob) => {
        if (!alive) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch(() => {
        if (alive) setFailed(true);
      });
    return () => {
      alive = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [file.path, attempt]);
  return (
    <div className="rounded border border-border p-3 space-y-2 min-w-0">
      <p className="text-sm break-all">{file.name}</p>
      <p className="text-xs text-muted-foreground">Anexo privado · acesso autenticado</p>
      {failed ? (
        <p role="status" className="text-sm">
          Não foi possível carregar.
          <button
            type="button"
            className="ml-2 underline focus-visible:outline focus-visible:outline-2"
            onClick={() => setAttempt((n) => n + 1)}
          >
            Tentar novamente
          </button>
        </p>
      ) : !url ? (
        <p role="status" className="text-sm">
          Carregando anexo…
        </p>
      ) : (
        <>
          {imageFailed && (
            <p className="text-sm">
              Prévia indisponível neste navegador. Baixe o anexo para visualizar.
            </p>
          )}
          {file.type.startsWith('image/') && !imageFailed && (
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="block focus-visible:outline focus-visible:outline-2"
              aria-label={'Abrir imagem: ' + file.name}
            >
              <img
                src={url}
                alt={file.name}
                onError={() => setImageFailed(true)}
                className="w-full h-40 object-contain rounded bg-muted"
              />
            </a>
          )}
          {file.type.startsWith('video/') && (
            <video
              src={url}
              controls
              preload="metadata"
              className="w-full max-h-64"
              aria-label={file.name}
            />
          )}
          <a
            href={url}
            download={file.name}
            className="inline-block underline text-sm focus-visible:outline focus-visible:outline-2"
          >
            Baixar anexo
          </a>
        </>
      )}
    </div>
  );
}
export default function WarrantySiteDetails({ claim }: { claim: WarrantyClaim }) {
  if (claim.origin !== 'site') return null;
  const details = [
    ['Protocolo', claim.siteProtocol],
    ['Pedido', claim.siteOrder],
    ['Canal', claim.siteContactChannel],
    ['Contato', claim.siteContact],
    ['Recebimento', claim.siteReceived ? claim.siteReceived.split('-').reverse().join('/') : ''],
    ['Peça instalada?', claim.siteInstalled],
    ['Veículo', claim.siteVehicle],
    ['Observações', claim.siteNotes],
  ];
  return (
    <section
      aria-label="Solicitação recebida pelo site"
      className="space-y-3 rounded border border-border p-4"
    >
      <h3 className="font-semibold">Recebida pelo Site</h3>
      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
        {details
          .filter(([, value]) => value)
          .map(([label, value]) => (
            <div key={label} className="min-w-0">
              <dt className="text-muted-foreground">{label}</dt>
              <dd className="whitespace-pre-wrap break-words">{value}</dd>
            </div>
          ))}
      </dl>
      {!!claim.siteAttachments?.length && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {claim.siteAttachments.map((file) => (
            <SiteAttachment key={file.path} file={file} />
          ))}
        </div>
      )}
    </section>
  );
}
