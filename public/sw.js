/* Cekat Web Push service worker.
   Push is shown only when at least one tab of the app is open and not focused
   (i.e. backgrounded or just woken from sleep). If every tab is closed, the
   push is dropped. If a tab is focused, the in-page GlobalMessageListener
   already plays sound + a toast, so the push is also dropped to avoid double
   notifying.
   Click → focus existing tab and navigate, or open a new one. */

const APP_URL_FALLBACK = self.location.origin;

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  event.waitUntil((async () => {
    // Browser is the source of truth for "is this tab open?". An empty clients
    // list means the user has closed every tab of the app (or the browser).
    const tabs = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    if (tabs.length === 0) return; // closed → drop the push

    // A focused + visible tab means the in-page notification handler will run.
    // Don't double-fire from the OS layer.
    const focused = tabs.find((c) => c.focused && c.visibilityState === 'visible');
    if (focused) return;

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

    await self.registration.showNotification(title, options);
  })());
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
