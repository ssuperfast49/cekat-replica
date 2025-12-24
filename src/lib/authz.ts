import { defaultFallbackHandler } from '@/lib/fallbackHandler';

export const AUTHZ_CHANGED_EVENT = 'app:authz-changed';

/**
 * Clear client-side caches that can leak stale/unauthorized data after a role/permission change.
 * This intentionally does NOT clear Supabase auth tokens.
 */
export function clearAuthzSensitiveCaches() {
  // Clear protectedSupabase fallback cache (persists to localStorage with `supabase_cache_*`)
  try { defaultFallbackHandler.clear(); } catch {}

  // Clear app-level caches (threads, agents, etc.)
  try {
    if (typeof localStorage === 'undefined') return;
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) keys.push(key);
    }
    for (const key of keys) {
      // `app.cached*` is used across multiple hooks for hydration/instant UI
      if (key.startsWith('app.cached')) {
        try { localStorage.removeItem(key); } catch {}
      }
    }
  } catch {}

  // Best-effort: clear any module-level memoized caches used by hooks
  try {
    const g = globalThis as any;
    if (g.__agentsCache) {
      g.__agentsCache.data = null;
      g.__agentsCache.ts = 0;
      g.__agentsCache.inFlight = null;
    }
  } catch {}
}

export function emitAuthzChanged(reason?: string) {
  try {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(new CustomEvent(AUTHZ_CHANGED_EVENT, { detail: { reason } }));
  } catch {}
}


