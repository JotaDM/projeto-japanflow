self.addEventListener('push', function (event) {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = {};
  }

  const notification = payload.notification || {};
  const data = payload.data || {};
  const notificationType = String(data.type || payload.type || '').toLowerCase();
  const incomingTitle = notification.title || data.title || payload.title || '';
  const incomingBody = notification.body || data.body || payload.body || 'Nova notificação';

  // Bloqueia pushes de chat identificados por tipo (defesa adicional).
  // O envio de mensagens também deve deixar de chamar a API FCM.
  if (notificationType === 'chat_message' || notificationType === 'message') return;

  const requestedUrl = data.url || payload.url || '/';
  let targetUrl = self.location.origin + '/';
  try {
    const candidate = new URL(requestedUrl, self.location.origin);
    if (candidate.origin === self.location.origin) targetUrl = candidate.href;
  } catch {
    // URL inválida: mantém a página inicial do próprio site.
  }

  const body =
    incomingTitle && incomingTitle !== 'JapanFlow'
      ? incomingTitle + ' — ' + incomingBody
      : incomingBody;
  const tag = data.tag || payload.tag || `japanflow-${Date.now()}`;

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
    if (candidate.origin === self.location.origin) targetUrl = candidate.href;
  } catch {
    // URL inválida: mantém a página inicial.
  }

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async (clientList) => {
      for (const client of clientList) {
        try {
          if (new URL(client.url).origin !== self.location.origin) continue;
          if ('navigate' in client) await client.navigate(targetUrl);
          if ('focus' in client) return client.focus();
        } catch {
          // Tenta a próxima janela ou abre uma nova.
        }
      }
      if (clients.openWindow) return clients.openWindow(targetUrl);
    })
  );
});
