/**
 * Fallback Handler and Cache Management
 * 
 * Implements response caching, offline support, and graceful degradation
 * strategies to ensure application continues working even when database is unavailable.
 */

export type CacheStrategy = 
  | 'network-first'      // Try network, fallback to cache
  | 'cache-first'        // Try cache, fallback to network
  | 'stale-while-revalidate' // Serve cache immediately, fetch fresh in background
  | 'network-only'       // Always fetch from network (no cache)
  | 'cache-only';        // Only use cache (no network)

export interface CacheEntry<T = any> {
  data: T;
  timestamp: number;
  etag?: string;
  version?: number;
  ttl?: number;          // Time to live in milliseconds
}

export interface CacheConfig {
  defaultTtl: number;    // Default cache TTL in milliseconds
  maxSize: number;       // Maximum number of cache entries
  strategy: CacheStrategy;
}

const DEFAULT_CONFIG: CacheConfig = {
  defaultTtl: 5 * 60 * 1000, // 5 minutes
  maxSize: 100,
  strategy: 'stale-while-revalidate',
};

const CACHE_PREFIX = 'supabase_cache_';
const CACHE_VERSION = '1'; // For cache invalidation

export class FallbackHandler {
  private cache: Map<string, CacheEntry> = new Map();
  private config: CacheConfig;

  constructor(config: Partial<CacheConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.loadFromStorage();
    
    // Clean up expired entries periodically
    if (typeof window !== 'undefined') {
      setInterval(() => this.cleanup(), 60000); // Every minute
    }
  }

  /**
   * Get cached response
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }

    // Check if entry is expired
    const now = Date.now();
    const ttl = entry.ttl || this.config.defaultTtl;
    
    if (entry.timestamp + ttl < now) {
      // Expired, remove from cache
      this.cache.delete(key);
      this.deleteFromStorage(key);
      return null;
    }

    return entry.data as T;
  }

  /**
   * Set cached response
   */
  set<T>(key: string, data: T, ttl?: number): void {
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttl: ttl || this.config.defaultTtl,
      version: parseInt(CACHE_VERSION),
    };

    // Check cache size limit
    if (this.cache.size >= this.config.maxSize) {
      // Remove oldest entry (LRU)
      const oldestKey = this.findOldestEntry();
      if (oldestKey) {
        this.cache.delete(oldestKey);
        this.deleteFromStorage(oldestKey);
      }
    }

    this.cache.set(key, entry);
    this.saveToStorage(key, entry);
  }

  /**
   * Execute with cache strategy
   */
  async execute<T>(
    key: string,
    fn: () => Promise<T>,
    strategy?: CacheStrategy,
    ttl?: number
  ): Promise<T> {
    const cacheStrategy = strategy || this.config.strategy;
    const cached = this.get<T>(key);

    switch (cacheStrategy) {
      case 'cache-first':
        if (cached) {
          return cached;
        }
        try {
          const fresh = await fn();
          this.set(key, fresh, ttl);
          return fresh;
        } catch (error) {
          if (cached) {
            // Return stale cache on error
            return cached;
          }
          throw error;
        }

      case 'network-first':
        try {
          const fresh = await fn();
          this.set(key, fresh, ttl);
          return fresh;
        } catch (error) {
          if (cached) {
            // Fallback to cache on error
            return cached;
          }
          throw error;
        }

      case 'stale-while-revalidate':
        // Return cache immediately if available
        if (cached) {
          // Fetch fresh data in background (fire and forget)
          fn()
            .then(fresh => {
              this.set(key, fresh, ttl);
            })
            .catch(() => {
              // Ignore background fetch errors
            });
          return cached;
        }
        // No cache, fetch fresh
        try {
          const fresh = await fn();
          this.set(key, fresh, ttl);
          return fresh;
        } catch (error) {
          throw error;
        }

      case 'network-only':
        try {
          const fresh = await fn();
          this.set(key, fresh, ttl);
          return fresh;
        } catch (error) {
          throw error;
        }

      case 'cache-only':
        if (cached) {
          return cached;
        }
        throw new Error('No cached data available');

      default:
        return await fn();
    }
  }

  /**
   * Invalidate cache entry
   */
  invalidate(key: string): void {
    this.cache.delete(key);
    this.deleteFromStorage(key);
  }

  /**
   * Invalidate cache entries matching pattern
   */
  invalidatePattern(pattern: string): void {
    const regex = new RegExp(pattern);
    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.invalidate(key);
      }
    }
  }

  /**
   * Clear all cache
   */
  clear(): void {
    this.cache.clear();
    
    // Clear from storage
    try {
      if (typeof localStorage !== 'undefined') {
        for (let i = localStorage.length - 1; i >= 0; i--) {
          const key = localStorage.key(i);
          if (key && key.startsWith(CACHE_PREFIX)) {
            localStorage.removeItem(key);
          }
        }
      }
    } catch (error) {
      console.warn('Failed to clear cache from storage:', error);
    }
  }

  /**
   * Find oldest cache entry (for LRU eviction)
   */
  private findOldestEntry(): string | null {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.timestamp < oldestTime) {
        oldestTime = entry.timestamp;
        oldestKey = key;
      }
    }

    return oldestKey;
  }

  /**
   * Cleanup expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    
    for (const [key, entry] of this.cache.entries()) {
      const ttl = entry.ttl || this.config.defaultTtl;
      if (entry.timestamp + ttl < now) {
        this.cache.delete(key);
        this.deleteFromStorage(key);
      }
    }
  }

  /**
   * Save to localStorage
   */
  private saveToStorage(key: string, entry: CacheEntry): void {
    try {
      if (typeof localStorage !== 'undefined') {
        const storageKey = `${CACHE_PREFIX}${key}`;
        localStorage.setItem(storageKey, JSON.stringify(entry));
      }
    } catch (error) {
      // Ignore storage errors (quota exceeded, etc.)
      console.warn('Failed to save cache entry:', error);
    }
  }

  /**
   * Load from localStorage
   */
  private loadFromStorage(): void {
    try {
      if (typeof localStorage !== 'undefined') {
        const now = Date.now();
        
        for (let i = 0; i < localStorage.length; i++) {
          const storageKey = localStorage.key(i);
          if (storageKey && storageKey.startsWith(CACHE_PREFIX)) {
            try {
              const data = JSON.parse(localStorage.getItem(storageKey) || '{}');
              const entry = data as CacheEntry;
              
              // Check version compatibility
              if (entry.version && entry.version !== parseInt(CACHE_VERSION)) {
                localStorage.removeItem(storageKey);
                continue;
              }
              
              // Check if expired
              const ttl = entry.ttl || this.config.defaultTtl;
              if (entry.timestamp + ttl < now) {
                localStorage.removeItem(storageKey);
                continue;
              }
              
              const key = storageKey.replace(CACHE_PREFIX, '');
              this.cache.set(key, entry);
            } catch {
              localStorage.removeItem(storageKey);
            }
          }
        }
      }
    } catch (error) {
      console.warn('Failed to load cache from storage:', error);
    }
  }

  /**
   * Delete from localStorage
   */
  private deleteFromStorage(key: string): void {
    try {
      if (typeof localStorage !== 'undefined') {
        const storageKey = `${CACHE_PREFIX}${key}`;
        localStorage.removeItem(storageKey);
      }
    } catch (error) {
      // Ignore
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    size: number;
    maxSize: number;
    entries: Array<{ key: string; age: number; ttl: number }>;
  } {
    const now = Date.now();
    const entries = Array.from(this.cache.entries()).map(([key, entry]) => ({
      key,
      age: now - entry.timestamp,
      ttl: entry.ttl || this.config.defaultTtl,
    }));

    return {
      size: this.cache.size,
      maxSize: this.config.maxSize,
      entries,
    };
  }
}

/**
 * Default fallback handler instance
 */
export const defaultFallbackHandler = new FallbackHandler();

/**
 * Offline Queue for Write Operations
 */
export interface QueuedWrite {
  id: string;
  operation: 'insert' | 'update' | 'upsert' | 'delete';
  table: string;
  data: any;
  timestamp: number;
  retries: number;
}

export class OfflineQueue {
  private queue: QueuedWrite[] = [];
  private processing: boolean = false;
  private maxRetries: number = 3;
  private storageKey = 'offline_queue';

  constructor() {
    this.loadFromStorage();
    
    // Try to process queue when online
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        this.processQueue();
      });
    }
  }

  /**
   * Add write operation to queue
   */
  add(write: Omit<QueuedWrite, 'id' | 'timestamp' | 'retries'>): string {
    const queuedWrite: QueuedWrite = {
      ...write,
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      retries: 0,
    };

    this.queue.push(queuedWrite);
    this.saveToStorage();
    
    // Try to process immediately if online
    if (typeof navigator !== 'undefined' && navigator.onLine) {
      this.processQueue();
    }

    return queuedWrite.id;
  }

  /**
   * Process queued write operations
   */
  async processQueue(executeFn?: (write: QueuedWrite) => Promise<void>): Promise<void> {
    if (this.processing || this.queue.length === 0) {
      return;
    }

    if (!executeFn) {
      // No executor provided, can't process
      return;
    }

    this.processing = true;

    try {
      const toProcess = [...this.queue];
      this.queue = [];

      for (const write of toProcess) {
        try {
          await executeFn(write);
          // Success, remove from storage
          this.remove(write.id);
        } catch (error) {
          write.retries++;
          
          if (write.retries < this.maxRetries) {
            // Retry later
            this.queue.push(write);
          } else {
            // Max retries exceeded, remove
            console.error('Failed to sync write operation after max retries:', write);
            this.remove(write.id);
          }
        }
      }

      this.saveToStorage();
    } finally {
      this.processing = false;
    }
  }

  /**
   * Remove item from queue
   */
  remove(id: string): void {
    this.queue = this.queue.filter(w => w.id !== id);
    this.saveToStorage();
  }

  /**
   * Get queue size
   */
  size(): number {
    return this.queue.length;
  }

  /**
   * Clear queue
   */
  clear(): void {
    this.queue = [];
    this.saveToStorage();
  }

  /**
   * Get all queued writes
   */
  getAll(): QueuedWrite[] {
    return [...this.queue];
  }

  /**
   * Save to localStorage
   */
  private saveToStorage(): void {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(this.storageKey, JSON.stringify(this.queue));
      }
    } catch (error) {
      console.warn('Failed to save offline queue:', error);
    }
  }

  /**
   * Load from localStorage
   */
  private loadFromStorage(): void {
    try {
      if (typeof localStorage !== 'undefined') {
        const data = localStorage.getItem(this.storageKey);
        if (data) {
          this.queue = JSON.parse(data);
        }
      }
    } catch (error) {
      console.warn('Failed to load offline queue:', error);
    }
  }
}

/**
 * Default offline queue instance
 */
export const defaultOfflineQueue = new OfflineQueue();

