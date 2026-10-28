// Local candidate only. Inject the already-configured Firebase callable.
// No staff login, API secret or service account belongs in this client.
export function createWarrantyTransport(callable) {
  if (typeof callable !== 'function') throw new TypeError('Transporte não configurado.');
  let pending = false;
  let requestId = '';
  let lastFingerprint = '';
  let lastResult = null;
  return async function send(fields, files = []) {
    if (pending) throw new Error('Aguarde o envio em andamento.');
    pending = true;
    try {
      const fileData = [];
      let total = 0;
      if (files.length > 5) throw new Error('Selecione até cinco anexos.');
      for (const file of files) {
        total += file.size;
        if (!file.size || total > 10 * 1024 * 1024)
          throw new Error('Os anexos devem somar até 10 MB.');
        const bytes = new Uint8Array(await file.arrayBuffer());
        let binary = '';
        for (let offset = 0; offset < bytes.length; offset += 32768)
          binary += String.fromCharCode(...bytes.subarray(offset, offset + 32768));
        const types = {
          jpg: 'image/jpeg',
          jpeg: 'image/jpeg',
          png: 'image/png',
          webp: 'image/webp',
          heic: 'image/heic',
          pdf: 'application/pdf',
          mp4: 'video/mp4',
          mov: 'video/quicktime',
          webm: 'video/webm',
        };
        const type = file.type || types[file.name.split('.').pop().toLowerCase()] || '';
        fileData.push({ name: file.name, type, base64: btoa(binary) });
      }
      // Same payload retains the ID after an uncertain response. Changed data creates a new request.
      const body = JSON.stringify({ ...fields, files: fileData });
      const hash = Array.from(
        new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(body))),
        (n) => n.toString(16).padStart(2, '0')
      ).join('');
      if (hash !== lastFingerprint) {
        requestId = crypto.randomUUID();
        lastFingerprint = hash;
        lastResult = null;
      }
      if (lastResult) return lastResult;
      const response = await callable({ ...fields, requestId, files: fileData });
      if (response?.data?.received !== true || typeof response.data.protocol !== 'string')
        throw new Error('Recebimento não confirmado. Tente novamente.');
      lastResult = response.data;
      return lastResult;
    } finally {
      pending = false;
    }
  };
}
