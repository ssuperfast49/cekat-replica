/**
 * Request Queue
 * 
 * Manages request queuing, deduplication, and priority handling
 * to optimize database operations and prevent duplicate requests.
 */

import { OperationType } from './rateLimiter';

export interface QueuedRequest<T = any> {
  id: string;
  fn: () => Promise<T>;
  priority: number;
  timestamp: number;
  operation: OperationType;
  endpoint?: string;
  resolve: (value: T) => void;
  reject: (error: any) => void;
}

export interface QueueConfig {
  maxSize: number;
  dedupeWindow: number;      // Milliseconds to dedupe similar requests
  batchWindow: number;       // Milliseconds to batch requests
  maxBatchSize: number;
}

const DEFAULT_CONFIG: QueueConfig = {
  maxSize: 100,
  dedupeWindow: 1000,        // 1 second deduplication window
  batchWindow: 100,         // 100ms batching window
  maxBatchSize: 10,
};

export class RequestQueue {
  private queue: QueuedRequest[] = [];
  private processing: boolean = false;
  private pendingRequests: Map<string, Promise<any>> = new Map();
  private config: QueueConfig;

  constructor(config: Partial<QueueConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Add request to queue with deduplication
   */
  async enqueue<T>(
    fn: () => Promise<T>,
    options: {
      operation: OperationType;
      endpoint?: string;
      priority?: number;
      dedupeKey?: string;
    } = { operation: 'read' }
  ): Promise<T> {
    const {
      operation = 'read',
      endpoint,
      priority = 0,
      dedupeKey,
    } = options;

    // Generate deduplication key
    const key = dedupeKey || this.generateDedupeKey(fn, endpoint);

    // Check if same request is already pending
    const pending = this.pendingRequests.get(key);
    if (pending) {
      // Return the existing promise
      return pending;
    }

    // Check queue size
    if (this.queue.length >= this.config.maxSize) {
      // Remove lowest priority item
      this.queue.sort((a, b) => b.priority - a.priority);
      const removed = this.queue.pop();
      if (removed) {
        removed.reject(new Error('Request queue full'));
      }
    }

    // Create promise for this request
    let resolve!: (value: T) => void;
    let reject!: (error: any) => void;
    
    const promise = new Promise<T>((res, rej) => {
      resolve = res;
      reject = rej;
    });

    // Store in pending map
    this.pendingRequests.set(key, promise);

    // Add to queue
    const request: QueuedRequest<T> = {
      id: key,
      fn,
      priority,
      timestamp: Date.now(),
      operation,
      endpoint,
      resolve,
      reject,
    };

    this.queue.push(request);
    this.queue.sort((a, b) => b.priority - a.priority); // Higher priority first

    // Process queue
    this.processQueue();

    // Clean up promise from pending map when done
    promise.finally(() => {
      this.pendingRequests.delete(key);
    });

    return promise;
  }

  /**
   * Process queue
   */
  private async processQueue(): Promise<void> {
    if (this.processing || this.queue.length === 0) {
      return;
    }

    this.processing = true;

    try {
      while (this.queue.length > 0) {
        // Get batch of requests (same operation type within window)
        const batch = this.getBatch();
        
        if (batch.length === 1) {
          // Execute single request
          const request = batch[0];
          try {
            const result = await request.fn();
            request.resolve(result);
          } catch (error) {
            request.reject(error);
          }
        } else {
          // Execute batch in parallel
          await Promise.allSettled(
            batch.map(async (request) => {
              try {
                const result = await request.fn();
                request.resolve(result);
              } catch (error) {
                request.reject(error);
              }
            })
          );
        }
      }
    } finally {
      this.processing = false;
    }
  }

  /**
   * Get batch of requests to process together
   */
  private getBatch(): QueuedRequest[] {
    if (this.queue.length === 0) {
      return [];
    }

    const now = Date.now();
    const batch: QueuedRequest[] = [];
    const first = this.queue[0];
    
    // Group requests by operation type within batch window
    for (let i = 0; i < this.queue.length && batch.length < this.config.maxBatchSize; i++) {
      const request = this.queue[i];
      const age = now - request.timestamp;
      
      if (
        request.operation === first.operation &&
        age <= this.config.batchWindow &&
        (!first.endpoint || request.endpoint === first.endpoint)
      ) {
        batch.push(request);
      }
    }

    // Remove processed requests from queue
    batch.forEach(req => {
      const index = this.queue.findIndex(r => r.id === req.id);
      if (index >= 0) {
        this.queue.splice(index, 1);
      }
    });

    return batch;
  }

  /**
   * Generate deduplication key
   */
  private generateDedupeKey(fn: Function, endpoint?: string): string {
    // Create a hash of the function and endpoint
    // This is a simple approach - in production, you might want more sophisticated hashing
    const fnString = fn.toString();
    const endpointStr = endpoint || '';
    return `${fnString}:${endpointStr}`.slice(0, 100); // Limit length
  }

  /**
   * Debounce: wait for requests to stop before executing
   */
  debounce<T>(
    fn: () => Promise<T>,
    delay: number = 300,
    options: {
      operation?: OperationType;
      endpoint?: string;
      priority?: number;
    } = {}
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      let timeoutId: NodeJS.Timeout | null = null;
      let lastCallTime = Date.now();

      const execute = async () => {
        try {
          const result = await this.enqueue(fn, {
            ...options,
            dedupeKey: `debounce:${options.endpoint || 'default'}`,
          });
          resolve(result);
        } catch (error) {
          reject(error);
        }
      };

      const schedule = () => {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
        
        timeoutId = setTimeout(() => {
          const now = Date.now();
          if (now - lastCallTime >= delay) {
            execute();
          } else {
            schedule(); // Reschedule
          }
        }, delay);
      };

      schedule();
    });
  }

  /**
   * Get queue statistics
   */
  getStats(): {
    queueLength: number;
    pendingRequests: number;
    processing: boolean;
  } {
    return {
      queueLength: this.queue.length,
      pendingRequests: this.pendingRequests.size,
      processing: this.processing,
    };
  }

  /**
   * Clear queue
   */
  clear(): void {
    // Reject all pending requests
    this.queue.forEach(request => {
      request.reject(new Error('Queue cleared'));
    });
    this.queue = [];
    this.pendingRequests.clear();
  }
}

/**
 * Default request queue instance
 */
export const defaultRequestQueue = new RequestQueue();

