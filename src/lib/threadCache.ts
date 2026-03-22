/**
 * Global Thread Cache for preventing Thundering Herds on realtime broadcasts.
 * Used by GlobalMessageListener and useConversations to share thread details
 * across the application without redundant database queries.
 */

export interface ThreadCacheEntry {
  data: any;
  expiresAt: number;
}

export const globalThreadCache = new Map<string, ThreadCacheEntry>();

export function getCachedThread(threadId: string): any | null {
  const cached = globalThreadCache.get(threadId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }
  return null;
}

export function setCachedThread(threadId: string, data: any, ttlMs: number = 10000) {
  globalThreadCache.set(threadId, {
    data,
    expiresAt: Date.now() + ttlMs,
  });
}
