import { useEffect, useState } from 'react';
import { getMessaging, getToken, isSupported, onMessage } from 'firebase/messaging';
import app, { auth } from '@/lib/firebase';

interface PushNotificationPayload {
  title: string;
  body: string;
}

const apiBaseUrl = () =>
  String(import.meta.env.VITE_WEB_API_BASE_URL || import.meta.env.VITE_API_BASE_URL || '').replace(
    /\/+$/,
    ''
  );

async function authenticatedPost(path: string, payload: unknown) {
  await auth.authStateReady();
  const firebaseUser = auth.currentUser;
  if (!firebaseUser) throw new Error('Usuário Firebase não autenticado.');
  const baseUrl = apiBaseUrl();
  if (!baseUrl) throw new Error('VITE_WEB_API_BASE_URL não configurada.');
  const response = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${await firebaseUser.getIdToken()}`,
    },
    body: JSON.stringify(payload),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error || `Push API HTTP ${response.status}`);
  return data;
}

async function registerCurrentBrowserToken(token: string) {
  return authenticatedPost('/push/register', {
    token,
    platform: 'web',
    userAgent: navigator.userAgent,
    origin: window.location.origin,
  });
}

export function usePushNotifications() {
  const [token, setToken] = useState<string | null>(null);
  const [notification, setNotification] = useState<PushNotificationPayload | null>(null);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    let cancelled = false;
    async function setupPush() {
      try {
        await auth.authStateReady();
        if (cancelled) return;
        if (!auth.currentUser) return;
        if (!('Notification' in window) || !('serviceWorker' in navigator)) return;
        if (!(await isSupported())) return;
        if (Notification.permission !== 'granted') return;
        const registration = await navigator.serviceWorker.register('/sw.js');
        await navigator.serviceWorker.ready;
        const messaging = getMessaging(app);
        const currentToken = await getToken(messaging, {
          vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY,
          serviceWorkerRegistration: registration,
        });
        if (!currentToken || cancelled) return;
        setToken(currentToken);
        await registerCurrentBrowserToken(currentToken);
        if (cancelled) return;
        unsubscribe = onMessage(messaging, (payload) => {
          const type = String(payload.data?.type || '').toLowerCase();
          if (type !== 'task') return;
          setNotification({
            title: payload.notification?.title || payload.data?.title || 'JapanFlow',
            body: payload.notification?.body || payload.data?.body || 'Nova tarefa',
          });
        });
      } catch (error) {
        console.error('Erro ao configurar push notifications:', error);
      }
    }
    void setupPush();
    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, []);
  return { token, notification };
}

export async function requestPushPermission() {
  if (!('Notification' in window)) throw new Error('Este navegador não suporta notificações.');
  return Notification.requestPermission();
}

export async function sendPushToUser(
  userId: string,
  title: string,
  body: string,
  url: string,
  eventId: string
): Promise<void> {
  if (!userId || !title || !body || !eventId) return;
  try {
    const result = await authenticatedPost('/push/send', {
      userId,
      title,
      body,
      url,
      eventId,
      type: 'task',
    });
    if (result?.found === 0) {
      console.info(`Usuário ${userId} ainda não possui dispositivo push habilitado neste domínio.`);
    }
  } catch (error) {
    console.warn('Não foi possível enviar push de tarefa:', error);
  }
}
