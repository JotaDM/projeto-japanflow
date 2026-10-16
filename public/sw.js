self.addEventListener('push', function (event) {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = {};
  }
  const data = payload.data || {};
  const notification = payload.notification || {};
  if (String(data.type || payload.type || '').toLowerCase() !== 'task') return;

  const requestedUrl = data.url || payload.url || '/';
  let targetUrl = self.location.origin + '/';
  try {
    const candidate = new URL(requestedUrl, self.location.origin);
    if (
      candidate.origin === self.location.origin &&
      ['http:', 'https:'].includes(candidate.protocol)
    ) {
      targetUrl = candidate.href;
    }
  } catch {
    /* Destino inválido: página inicial. */
  }

  const incomingTitle = notification.title || data.title || payload.title || 'JapanFlow';
  const incomingBody = notification.body || data.body || payload.body || 'Nova tarefa';
  const body = incomingTitle !== 'JapanFlow' ? `${incomingTitle} — ${incomingBody}` : incomingBody;
  const tag = String(data.tag || payload.tag || `japanflow-${data.eventId || 'task'}`);

  event.waitUntil(
    self.registration.showNotification('JapanFlow', {
      body,
      icon: '/favicon-light.png',
      badge: '/favicon-light.png',
      tag,
      renotify: false,
      data: { url: targetUrl },
    })
  );
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  const requestedUrl = event.notification.data?.url || '/';
  let targetUrl = self.location.origin + '/';
  try {
    const candidate = new URL(requestedUrl, self.location.origin);
    if (
      candidate.origin === self.location.origin &&
      ['https:', 'http:'].includes(candidate.protocol)
    ) {
      targetUrl = candidate.href;
    }
  } catch {
    /* Destino inválido. */
  }
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async (clientList) => {
      for (const client of clientList) {
        try {
          if (new URL(client.url).origin !== self.location.origin) continue;
          if ('navigate' in client) await client.navigate(targetUrl);
          if ('focus' in client) return client.focus();
        } catch {
          /* Prossegue para a próxima janela. */
        }
      }
      if (clients.openWindow) return clients.openWindow(targetUrl);
    })
  );
});
