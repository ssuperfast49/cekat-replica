import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function arrayBufferToBase64(buffer: ArrayBuffer | null): string {
  if (!buffer) return '';
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

async function syncSubscription(sub: PushSubscription, userId: string) {
  const json = sub.toJSON();
  const endpoint = sub.endpoint;
  const p256dh = json.keys?.p256dh || arrayBufferToBase64(sub.getKey('p256dh'));
  const auth = json.keys?.auth || arrayBufferToBase64(sub.getKey('auth'));
  if (!endpoint || !p256dh || !auth) return;

  await supabase
    .from('push_subscriptions')
    .upsert(
      {
        user_id: userId,
        endpoint,
        p256dh,
        auth,
        user_agent: navigator.userAgent,
        last_used_at: new Date().toISOString(),
      },
      { onConflict: 'endpoint' }
    );
}

async function ensureSubscription(reg: ServiceWorkerRegistration): Promise<PushSubscription | null> {
  if (!VAPID_PUBLIC_KEY) {
    console.warn('[push] VITE_VAPID_PUBLIC_KEY is not set; skipping push subscription');
    return null;
  }
  let sub = await reg.pushManager.getSubscription();
  if (sub) return sub;
  try {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });
    return sub;
  } catch (err) {
    console.warn('[push] subscribe failed', err);
    return null;
  }
}

export function usePushNotifications() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const initializedForUserRef = useRef<string | null>(null);

  // Handle clicks coming from the service worker -> navigate to thread
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      const data = event.data;
      if (!data || data.type !== 'cekat:notification-click') return;
      if (data.url) navigate(data.url);
    };
    navigator.serviceWorker?.addEventListener('message', onMessage);
    return () => navigator.serviceWorker?.removeEventListener('message', onMessage);
  }, [navigate]);

  // On login, register SW and subscribe (logged-in = opted-in)
  useEffect(() => {
    if (!user) {
      initializedForUserRef.current = null;
      return;
    }
    if (initializedForUserRef.current === user.id) return;

    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
    if (!VAPID_PUBLIC_KEY) return;

    let cancelled = false;

    (async () => {
      try {
        const reg = await navigator.serviceWorker.register('/sw.js');
        await navigator.serviceWorker.ready;

        // Request permission if not yet decided. Many browsers require a user gesture
        // for the first request — if blocked, we silently no-op and rely on the user
        // re-triggering via the existing in-app prompt.
        if (Notification.permission === 'default') {
          try {
            await Notification.requestPermission();
          } catch (_) {
            // ignored
          }
        }
        if (Notification.permission !== 'granted') return;

        const sub = await ensureSubscription(reg);
        if (cancelled || !sub) return;

        await syncSubscription(sub, user.id);
        initializedForUserRef.current = user.id;

        // Browser may rotate the subscription; resync when it does
        navigator.serviceWorker.addEventListener('pushsubscriptionchange', async () => {
          const fresh = await ensureSubscription(reg);
          if (fresh) await syncSubscription(fresh, user.id);
        });
      } catch (err) {
        console.warn('[push] init failed', err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user]);
}

// Exposed for an optional UI button if the auto-prompt was blocked.
export async function enablePushNotificationsInteractive(userId: string): Promise<boolean> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !VAPID_PUBLIC_KEY) return false;
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return false;
  const reg = await navigator.serviceWorker.register('/sw.js');
  await navigator.serviceWorker.ready;
  const sub = await ensureSubscription(reg);
  if (!sub) return false;
  await syncSubscription(sub, userId);
  return true;
}
