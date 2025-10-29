/**
 * Rate Limiter Implementation
 * 
 * Implements sliding window rate limiting to prevent abuse and DDoS.
 * Tracks requests per user and per endpoint with configurable limits.
 */

export type OperationType = 'read' | 'write' | 'rpc' | 'auth';

export interface RateLimitConfig {
  limit: number;      // Maximum requests
  window: number;     // Time window in milliseconds
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;    // Timestamp when limit resets
  retryAfter?: number; // Milliseconds to wait before retry
}

export interface RateLimiterConfig {
  reads: RateLimitConfig;
  writes: RateLimitConfig;
  rpc: RateLimitConfig;
  auth: RateLimitConfig;
}

const DEFAULT_CONFIG: RateLimiterConfig = {
  reads: { limit: 100, window: 60000 },    // 100 per minute
  writes: { limit: 30, window: 60000 },   // 30 per minute
  rpc: { limit: 20, window: 60000 },       // 20 per minute
  auth: { limit: 10, window: 60000 },      // 10 per minute
};

interface RequestRecord {
  timestamp: number;
  operation: OperationType;
  endpoint?: string;
}

const STORAGE_PREFIX = 'rate_limit_';

export class RateLimiter {
  private config: RateLimiterConfig;
  private requests: Map<string, RequestRecord[]> = new Map(); // key: userId:endpoint:operation
  private storageKey: string;

  constructor(
    public readonly name: string = 'default',
    config: Partial<RateLimiterConfig> = {}
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.storageKey = `${STORAGE_PREFIX}${name}`;
    this.loadFromStorage();
    
    // Clean up old entries periodically
    if (typeof window !== 'undefined') {
      setInterval(() => this.cleanup(), 60000); // Clean every minute
    }
  }

  /**
   * Check if request is allowed
   */
  checkLimit(
    userId: string | null,
    operation: OperationType,
    endpoint?: string
  ): RateLimitResult {
    const key = this.getKey(userId, operation, endpoint);
    const now = Date.now();
    const config = this.getConfig(operation);
    
    // Get existing requests for this key
    let requests = this.requests.get(key) || [];
    
    // Remove requests outside the time window
    const cutoff = now - config.window;
    requests = requests.filter(r => r.timestamp > cutoff);
    
    // Check if limit is exceeded
    const count = requests.length;
    const allowed = count < config.limit;
    
    // Calculate reset time (oldest request + window)
    const oldestRequest = requests[0];
    const resetAt = oldestRequest ? oldestRequest.timestamp + config.window : now + config.window;
    
    // Calculate retry after (if not allowed)
    const retryAfter = allowed ? undefined : Math.ceil((resetAt - now) / 1000) * 1000;
    
    const result: RateLimitResult = {
      allowed,
      remaining: Math.max(0, config.limit - count - 1),
      resetAt,
      retryAfter,
    };
    
    // If allowed, record the request
    if (allowed) {
      requests.push({
        timestamp: now,
        operation,
        endpoint,
      });
      this.requests.set(key, requests);
      this.saveToStorage(key, requests);
    }
    
    return result;
  }

  /**
   * Record a request (for tracking purposes)
   */
  recordRequest(
    userId: string | null,
    operation: OperationType,
    endpoint?: string
  ): void {
    const key = this.getKey(userId, operation, endpoint);
    const now = Date.now();
    
    let requests = this.requests.get(key) || [];
    requests.push({
      timestamp: now,
      operation,
      endpoint,
    });
    
    // Remove old requests outside window
    const config = this.getConfig(operation);
    const cutoff = now - config.window;
    requests = requests.filter(r => r.timestamp > cutoff);
    
    this.requests.set(key, requests);
    this.saveToStorage(key, requests);
  }

  /**
   * Get current usage for a key
   */
  getUsage(
    userId: string | null,
    operation: OperationType,
    endpoint?: string
  ): { count: number; limit: number; resetAt: number } {
    const key = this.getKey(userId, operation, endpoint);
    const now = Date.now();
    const config = this.getConfig(operation);
    
    let requests = this.requests.get(key) || [];
    const cutoff = now - config.window;
    requests = requests.filter(r => r.timestamp > cutoff);
    
    const oldestRequest = requests[0];
    const resetAt = oldestRequest ? oldestRequest.timestamp + config.window : now + config.window;
    
    return {
      count: requests.length,
      limit: config.limit,
      resetAt,
    };
  }

  /**
   * Reset rate limit for a key
   */
  reset(
    userId: string | null,
    operation?: OperationType,
    endpoint?: string
  ): void {
    if (operation) {
      const key = this.getKey(userId, operation, endpoint);
      this.requests.delete(key);
      this.deleteFromStorage(key);
    } else {
      // Reset all for user
      const prefix = userId ? `${userId}:` : 'anonymous:';
      for (const key of this.requests.keys()) {
        if (key.startsWith(prefix)) {
          this.requests.delete(key);
          this.deleteFromStorage(key);
        }
      }
    }
  }

  /**
   * Cleanup old entries
   */
  private cleanup(): void {
    const now = Date.now();
    const maxWindow = Math.max(
      this.config.reads.window,
      this.config.writes.window,
      this.config.rpc.window,
      this.config.auth.window
    );
    const cutoff = now - maxWindow;
    
    for (const [key, requests] of this.requests.entries()) {
      const filtered = requests.filter(r => r.timestamp > cutoff);
      if (filtered.length === 0) {
        this.requests.delete(key);
        this.deleteFromStorage(key);
      } else if (filtered.length !== requests.length) {
        this.requests.set(key, filtered);
        this.saveToStorage(key, filtered);
      }
    }
  }

  /**
   * Get configuration for operation type
   */
  private getConfig(operation: OperationType): RateLimitConfig {
    return this.config[operation];
  }

  /**
   * Generate storage key
   */
  private getKey(userId: string | null, operation: OperationType, endpoint?: string): string {
    const user = userId || 'anonymous';
    return `${user}:${operation}${endpoint ? `:${endpoint}` : ''}`;
  }

  /**
   * Save to localStorage
   */
  private saveToStorage(key: string, requests: RequestRecord[]): void {
    try {
      if (typeof localStorage !== 'undefined') {
        const storageKey = `${this.storageKey}:${key}`;
        // Only store recent requests (last minute worth)
        const now = Date.now();
        const recent = requests.filter(r => now - r.timestamp < 60000);
        localStorage.setItem(storageKey, JSON.stringify({
          requests: recent,
          savedAt: now,
        }));
      }
    } catch (error) {
      // Ignore storage errors (quota exceeded, etc.)
      console.warn('Failed to save rate limit data:', error);
    }
  }

  /**
   * Load from localStorage
   */
  private loadFromStorage(): void {
    try {
      if (typeof localStorage !== 'undefined') {
        const now = Date.now();
        const prefix = `${this.storageKey}:`;
        
        // Load all rate limit entries
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith(prefix)) {
            try {
              const data = JSON.parse(localStorage.getItem(key) || '{}');
              const savedAt = data.savedAt || 0;
              
              // Only load if saved within last 5 minutes
              if (now - savedAt < 300000) {
                const requests = (data.requests || []).filter((r: RequestRecord) => {
                  // Only keep requests within time windows
                  const operation = r.operation || 'read';
                  const config = this.getConfig(operation);
                  return now - r.timestamp < config.window;
                });
                
                if (requests.length > 0) {
                  const keyWithoutPrefix = key.replace(prefix, '');
                  this.requests.set(keyWithoutPrefix, requests);
                } else {
                  localStorage.removeItem(key);
                }
              } else {
                localStorage.removeItem(key);
              }
            } catch {
              localStorage.removeItem(key);
            }
          }
        }
      }
    } catch (error) {
      console.warn('Failed to load rate limit data:', error);
    }
  }

  /**
   * Delete from localStorage
   */
  private deleteFromStorage(key: string): void {
    try {
      if (typeof localStorage !== 'undefined') {
        const storageKey = `${this.storageKey}:${key}`;
        localStorage.removeItem(storageKey);
      }
    } catch (error) {
      // Ignore
    }
  }
}

/**
 * Default rate limiter instance
 */
export const defaultRateLimiter = new RateLimiter('default', DEFAULT_CONFIG);

