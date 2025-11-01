/**
 * Protected Supabase Client Wrapper
 * 
 * Wraps the Supabase client with circuit breaker protection,
 * error handling, retry logic, and timeout management.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { databaseCircuitBreaker, CircuitState } from './circuitBreaker';
import { classifyError, isRetryableError, getRetryDelay, getUserFriendlyMessage, ErrorCategory } from './errorHandler';
import { defaultRateLimiter, OperationType, RateLimitResult } from './rateLimiter';
import { defaultAdaptiveRateLimiter } from './adaptiveRateLimiter';
import { defaultRequestQueue } from './requestQueue';
import { defaultFallbackHandler, CacheStrategy } from './fallbackHandler';
import { defaultMetricsCollector } from './metrics';

/**
 * Exponential backoff retry logic
 */
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: any;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      const classified = classifyError(error);
      
      // Don't retry if error is not retryable
      if (!classified.isRetryable) {
        throw error;
      }

      // Don't retry if circuit breaker is open
      if (databaseCircuitBreaker.getState() !== 'CLOSED') {
        throw error;
      }

      // Don't retry on last attempt
      if (attempt >= maxRetries) {
        break;
      }

      // Calculate delay with exponential backoff (capped at 8 seconds)
      const delay = Math.min(baseDelay * Math.pow(2, attempt), 8000);
      
      // Use error-specific delay if available
      const retryDelay = classified.retryDelay || delay;
      
      await new Promise(resolve => setTimeout(resolve, retryDelay));
    }
  }

  throw lastError;
}

// Cache user ID to avoid repeated auth calls
let cachedUserId: string | null = null;
let userIdCacheTime: number = 0;
const USER_ID_CACHE_TTL = 60000; // 1 minute

/**
 * Get current user ID for rate limiting (cached)
 */
async function getUserId(supabaseInstance: SupabaseClient, skipCache: boolean = false): Promise<string | null> {
  const now = Date.now();
  
  // Return cached user ID if valid
  if (!skipCache && cachedUserId !== null && (now - userIdCacheTime) < USER_ID_CACHE_TTL) {
    return cachedUserId;
  }
  
  try {
    // Try to get user from session (use direct call to avoid recursion)
    // Use a timeout to prevent blocking
    const sessionPromise = supabaseInstance.auth.getSession();
    const timeoutPromise = new Promise<{ data: { session: null } }>((resolve) => {
      setTimeout(() => resolve({ data: { session: null } }), 500); // 500ms timeout
    });
    
    const { data } = await Promise.race([sessionPromise, timeoutPromise]);
    
    cachedUserId = data?.session?.user?.id || null;
    userIdCacheTime = now;
    return cachedUserId;
  } catch {
    cachedUserId = null;
    userIdCacheTime = now;
    return null;
  }
}

/**
 * Check rate limit before executing request
 */
async function checkRateLimit(
  supabaseInstance: SupabaseClient,
  operation: OperationType,
  endpoint?: string,
  userId?: string | null,
  bypassRateLimit: boolean = false
): Promise<void> {
  // Allow bypass for critical operations or when explicitly requested
  if (bypassRateLimit) {
    return;
  }
  
  // Use adaptive rate limiter for better traffic spike handling
  const resolvedUserId = userId !== undefined ? userId : await getUserId(supabaseInstance).catch(() => null);
  
  // For RPC calls, be more lenient - they're typically batch operations
  if (operation === 'rpc') {
    // Get adaptive limit
    const usage = defaultAdaptiveRateLimiter.getUsage(resolvedUserId, operation, endpoint);
    
    // Allow if we're under 90% of adaptive limit
    if (usage.count < usage.limit * 0.9) {
      defaultAdaptiveRateLimiter.recordRequest(resolvedUserId, operation, endpoint);
      return;
    }
    
    // Otherwise check normally with adaptive limiter
    const result = defaultAdaptiveRateLimiter.checkLimit(resolvedUserId, operation, endpoint);
    if (!result.allowed) {
      const error: any = new Error(
        result.retryAfter 
          ? `Rate limit exceeded. Please wait ${Math.ceil(result.retryAfter / 1000)} seconds.`
          : 'Rate limit exceeded. Please try again later.'
      );
      error.code = 'RATE_LIMIT_EXCEEDED';
      error.status = 429;
      error.retryAfter = result.retryAfter;
      error.category = 'RATE_LIMIT';
      throw error;
    }
    return;
  }
  
  // For other operations, use adaptive rate limiter
  const result = defaultAdaptiveRateLimiter.checkLimit(resolvedUserId, operation, endpoint);
  
  if (!result.allowed) {
    const error: any = new Error(
      result.retryAfter 
        ? `Rate limit exceeded. Please wait ${Math.ceil(result.retryAfter / 1000)} seconds.`
        : 'Rate limit exceeded. Please try again later.'
    );
    error.code = 'RATE_LIMIT_EXCEEDED';
    error.status = 429;
    error.retryAfter = result.retryAfter;
    error.category = 'RATE_LIMIT';
    throw error;
  }
}

// Track ongoing background refreshes to prevent infinite loops
const backgroundRefreshes = new Set<string>();

/**
 * Protected Query Builder Wrapper
 * 
 * Wraps Supabase's query builder to intercept the promise resolution
 * and apply circuit breaker protection, rate limiting, and queue management.
 */
function wrapQueryBuilder(
  queryBuilder: any,
  supabaseInstance: SupabaseClient,
  operation: OperationType = 'read',
  endpoint?: string,
  skipBackgroundRefresh: boolean = false
): any {
  // Return a Proxy that intercepts method calls and promise resolution
  return new Proxy(queryBuilder, {
    get(target: any, prop: string) {
      const value = target[prop];
      
      // Determine operation type based on method (rough heuristic)
      let currentOperation = operation;
      if (prop === 'insert' || prop === 'update' || prop === 'upsert' || prop === 'delete') {
        currentOperation = 'write';
      }
      
      // Intercept promise methods (when query is actually executed)
      if (prop === 'then' || prop === 'catch' || prop === 'finally') {
        // When promise is awaited (then/catch is called), wrap with protections
        const originalPromise = Promise.resolve(target);
        
        // Wrap with queue, rate limiting, circuit breaker, caching, and metrics
        const protectedPromise = (async () => {
          const startTime = Date.now();
          const cacheKey = endpoint ? `query:${endpoint}:${currentOperation}` : undefined;
          
          // For read operations, try cache first (before any async calls)
          if (currentOperation === 'read' && cacheKey && !skipBackgroundRefresh) {
            const cached = defaultFallbackHandler.get(cacheKey);
            if (cached && !backgroundRefreshes.has(cacheKey)) {
              // Return cached immediately - no rate limiting, no queue, no metrics
              return cached;
            }
          }
          
          // Get user ID lazily (after cache check) with timeout protection
          const userIdPromise = getUserId(supabaseInstance).catch(() => null);
          const circuitState = databaseCircuitBreaker.getState();
          
          // Check rate limit with fast path for reads
          try {
            const userId = await Promise.race([
              userIdPromise,
              new Promise<string | null>((resolve) => setTimeout(() => resolve(null), 100))
            ]);
            // For reads, just record the request (non-blocking) with adaptive limiter
            if (currentOperation === 'read') {
              defaultAdaptiveRateLimiter.recordRequest(userId, currentOperation, endpoint);
            } else {
              await checkRateLimit(supabaseInstance, currentOperation, endpoint, userId);
            }
          } catch (rateLimitError: any) {
            // Only block if actually rate limited
            if (rateLimitError.code === 'RATE_LIMIT_EXCEEDED') {
              throw rateLimitError;
            }
            // Silently allow other errors to prevent blocking
          }
          
          // Execute directly instead of queuing to prevent deadlocks
          // Queue is disabled temporarily to prevent blocking
          let result;
          try {
            result = await databaseCircuitBreaker.execute(() => 
              retryWithBackoff(async () => {
                return await originalPromise;
              })
            );
          } catch (error) {
            result = {
              data: null,
              error: error,
            };
          }
          
          // Cache successful read responses
          if (currentOperation === 'read' && cacheKey && result && !result.error && result.data) {
            defaultFallbackHandler.set(cacheKey, result, 5 * 60 * 1000); // 5 min TTL
          }
          
          // Record metrics (non-blocking)
          const responseTime = Date.now() - startTime;
          const errorCategory = result?.error ? classifyError(result.error).category : undefined;
          const userId = await userIdPromise.catch(() => null);
          
          // Record metrics asynchronously to avoid blocking
          Promise.resolve().then(() => {
            try {
              defaultMetricsCollector.record({
                operationType: currentOperation,
                endpoint,
                userId: userId || undefined,
                circuitBreakerState: circuitState,
                success: !result?.error,
                errorCategory,
                responseTimeMs: responseTime,
                metadata: result?.error ? { error: result.error.message } : {},
              });
            } catch {
              // Ignore metric recording errors
            }
          });
          
          return result;
        })().catch((error) => {
          // Record error metrics
          const responseTime = Date.now() - startTime;
          const classified = classifyError(error);
          
          defaultMetricsCollector.record({
            operationType: currentOperation,
            endpoint,
            userId: userId || undefined,
            circuitBreakerState: circuitState,
            success: false,
            errorCategory: classified.category,
            responseTimeMs: responseTime,
            metadata: { error: error instanceof Error ? error.message : String(error) },
          });
          
          // Classify and enhance error for Supabase's error format
          
          // Handle rate limit errors specially
          if (error.code === 'RATE_LIMIT_EXCEEDED') {
            return {
              data: null,
              error: {
                message: error.message,
                code: 'RATE_LIMIT_EXCEEDED',
                status: 429,
                category: 'RATE_LIMIT',
                retryAfter: error.retryAfter,
                circuitBreaker: databaseCircuitBreaker.getState(),
              },
            };
          }
          
          // If error has data/error structure (Supabase format), preserve it
          if (error && typeof error === 'object' && ('data' in error || 'error' in error)) {
            return {
              data: error.data || null,
              error: {
                ...error.error || error,
                message: classified.userMessage,
                category: classified.category,
                circuitBreaker: databaseCircuitBreaker.getState(),
              },
            };
          }
          
          // Create Supabase-style error response
          const enhancedError = {
            ...classified.originalError,
            message: classified.userMessage,
            category: classified.category,
            circuitBreaker: databaseCircuitBreaker.getState(),
          };
          
          return {
            data: null,
            error: enhancedError,
          };
        });

        return (onFulfilled?: any, onRejected?: any) => {
          return protectedPromise[prop](onFulfilled, onRejected);
        };
      }

      // For query builder methods (select, where, etc.), chain them normally
      if (typeof value === 'function') {
        return (...args: any[]) => {
          const newBuilder = value.apply(target, args);
          // Recursively wrap the new builder with updated operation type
          // Preserve skipBackgroundRefresh flag through the chain
          return wrapQueryBuilder(newBuilder, supabaseInstance, currentOperation, endpoint, skipBackgroundRefresh);
        };
      }
      
      // Return other properties as-is
      return value;
    },
  });
}

/**
 * Create protected Supabase client wrapper
 */
export function createProtectedSupabaseClient(supabaseInstance: SupabaseClient) {
  // Store reference for getUserId
  const supabase = supabaseInstance;
  
  return {
    // Wrap the 'from' method
    from: (table: string) => {
      const queryBuilder = supabase.from(table);
      return wrapQueryBuilder(queryBuilder, supabase, 'read', table);
    },

    // Wrap RPC calls
    rpc: async <T = any>(
      functionName: string,
      args?: any,
      options?: { count?: 'exact' | 'planned' | 'estimated' }
    ): Promise<{ data: T | null; error: any }> => {
      const startTime = Date.now();
      const cacheKey = `rpc:${functionName}:${JSON.stringify(args || {})}`;
      
      // Try cache first (before any async calls)
      const cached = defaultFallbackHandler.get<{ data: T | null; error: any }>(cacheKey);
      if (cached && !cached.error && !backgroundRefreshes.has(cacheKey)) {
        // Return cached immediately
        return cached;
      }
      
      // Get user ID and circuit state lazily
      const userIdPromise = getUserId(supabase).catch(() => null);
      const circuitState = databaseCircuitBreaker.getState();
      
      try {
        // For RPC, use more lenient rate limiting
        // Most RPCs are batch operations from analytics/dashboard
        try {
          const userId = await Promise.race([
            userIdPromise,
            new Promise<string | null>((resolve) => setTimeout(() => resolve(null), 100))
          ]);
          // Use lenient rate limiting for RPC (allows up to 90% of limit before blocking)
          await checkRateLimit(supabase, 'rpc', functionName, userId, false);
        } catch (rateLimitError: any) {
          // Only block if actually rate limited, allow other errors
          if (rateLimitError.code === 'RATE_LIMIT_EXCEEDED') {
            throw rateLimitError;
          }
          // Silently allow other errors to prevent blocking
        }
        
        // Execute directly (queue disabled to prevent deadlocks)
        const result = await databaseCircuitBreaker.execute(() => 
          retryWithBackoff(async () => {
            return await supabase.rpc(functionName, args, options);
          })
        );

        // Cache successful results
        if (result && !result.error) {
          defaultFallbackHandler.set(cacheKey, result, 5 * 60 * 1000);
        }

        // Record metrics asynchronously
        const responseTime = Date.now() - startTime;
        const errorCategory = result?.error ? classifyError(result.error).category : undefined;
        const userId = await userIdPromise.catch(() => null);
        
        Promise.resolve().then(() => {
          try {
            defaultMetricsCollector.record({
              operationType: 'rpc',
              endpoint: functionName,
              userId: userId || undefined,
              circuitBreakerState: circuitState,
              success: !result?.error,
              errorCategory,
              responseTimeMs: responseTime,
              metadata: result?.error ? { error: result.error.message } : {},
            });
          } catch {
            // Ignore metric errors
          }
        });

        return result;
      } catch (error) {
        const classified = classifyError(error);
        const responseTime = Date.now() - startTime;
        const userId = await userIdPromise.catch(() => null);
        
        // Record error metric asynchronously
        Promise.resolve().then(() => {
          try {
            defaultMetricsCollector.record({
              operationType: 'rpc',
              endpoint: functionName,
              userId: userId || undefined,
              circuitBreakerState: circuitState,
              success: false,
              errorCategory: classified.category,
              responseTimeMs: responseTime,
              metadata: { error: error instanceof Error ? error.message : String(error) },
            });
          } catch {
            // Ignore
          }
        });
        
        return {
          data: null,
          error: {
            ...classified.originalError,
            message: classified.userMessage,
            category: classified.category,
            circuitBreaker: circuitState,
          },
        };
      }
    },

    // Wrap auth methods (with simpler protection as they're less frequent)
    auth: {
      getSession: async () => {
        try {
          return await databaseCircuitBreaker.execute(() => 
            supabase.auth.getSession(),
            5000 // Shorter timeout for auth
          );
        } catch (error) {
          const classified = classifyError(error);
          throw new Error(classified.userMessage);
        }
      },
      
      getUser: async () => {
        try {
          return await databaseCircuitBreaker.execute(() => 
            supabase.auth.getUser(),
            5000
          );
        } catch (error) {
          const classified = classifyError(error);
          throw new Error(classified.userMessage);
        }
      },
      
      signOut: async () => {
        try {
          return await databaseCircuitBreaker.execute(() => 
            supabase.auth.signOut(),
            5000
          );
        } catch (error) {
          const classified = classifyError(error);
          throw new Error(classified.userMessage);
        }
      },
      
      signInWithPassword: async (credentials: { email: string; password: string }) => {
        try {
          return await databaseCircuitBreaker.execute(() => 
            supabase.auth.signInWithPassword(credentials),
            10000
          );
        } catch (error) {
          const classified = classifyError(error);
          throw new Error(classified.userMessage);
        }
      },
      
      signInWithOtp: async (email: string, options?: any) => {
        try {
          return await databaseCircuitBreaker.execute(() => 
            supabase.auth.signInWithOtp({ email, options }),
            10000
          );
        } catch (error) {
          const classified = classifyError(error);
          throw new Error(classified.userMessage);
        }
      },
      
      verifyOtp: async (params: { email: string; token: string; type: 'email' }) => {
        try {
          return await databaseCircuitBreaker.execute(() => 
            supabase.auth.verifyOtp(params),
            10000
          );
        } catch (error) {
          const classified = classifyError(error);
          throw new Error(classified.userMessage);
        }
      },
      
      // Pass through other auth methods
      onAuthStateChange: supabase.auth.onAuthStateChange.bind(supabase.auth),
      resetPasswordForEmail: supabase.auth.resetPasswordForEmail.bind(supabase.auth),
      refreshSession: supabase.auth.refreshSession.bind(supabase.auth),
      updateUser: supabase.auth.updateUser.bind(supabase.auth),
      setSession: supabase.auth.setSession.bind(supabase.auth),
    },

    // Pass through storage methods (can be enhanced later)
    storage: supabase.storage,

    // Pass through realtime methods (can be enhanced later)
    channel: supabase.channel.bind(supabase),
    removeChannel: supabase.removeChannel.bind(supabase),
    removeAllChannels: supabase.removeAllChannels.bind(supabase),
    getChannels: supabase.getChannels.bind(supabase),

    // Expose circuit breaker for monitoring
    getCircuitBreaker: () => databaseCircuitBreaker,
    
    // Get circuit breaker stats
    getCircuitBreakerStats: () => databaseCircuitBreaker.getStats(),
  };
}

