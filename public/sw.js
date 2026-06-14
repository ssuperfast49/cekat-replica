/* Cekat Web Push service worker.
   Receives push from the send-push Edge Function and shows a notification
   even when the tab is backgrounded, closed, or the device just woke from sleep.
   Click → focus existing tab and navigate, or open a new one. */

const APP_URL_FALLBACK = self.location.origin;

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch (_) {
    payload = { title: 'New message', body: event.data ? event.data.text() : '' };
  }

  const title = payload.title || 'New message';
  const body = payload.body || '';
  const threadId = payload.thread_id || '';
  const url = payload.url || (threadId ? `/?menu=chat&thread=${threadId}` : '/');

  const options = {
    body: body ? `${body}\n\nClick to open the thread.` : 'Click to open the thread.',
    icon: payload.icon || '/favicon.ico',
    badge: payload.badge || '/favicon.ico',
    tag: threadId || 'cekat-message',
    renotify: true,
    requireInteraction: false,
    data: { url, thread_id: threadId, message_id: payload.message_id || null },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || '/';

  event.waitUntil((async () => {
    const allClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });

    for (const client of allClients) {
      const clientUrl = new URL(client.url);
      if (clientUrl.origin === self.location.origin) {
        try {
          await client.focus();
          client.postMessage({ type: 'cekat:notification-click', url: targetUrl, thread_id: event.notification.data?.thread_id });
          return;
        } catch (_) {
          // fall through to openWindow
        }
      }
    }

    await self.clients.openWindow(targetUrl.startsWith('http') ? targetUrl : `${APP_URL_FALLBACK}${targetUrl}`);
  })());
});
