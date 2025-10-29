/**
 * Request Batcher
 * 
 * Batches similar queries together to reduce total request count
 * and optimize database operations.
 */

import { OperationType } from './rateLimiter';

export interface BatchedRequest<T = any> {
  id: string;
  fn: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (error: any) => void;
  table?: string;
  operation: OperationType;
  timestamp: number;
}

export interface BatchConfig {
  window: number;        // Time window in milliseconds
  maxBatchSize: number;  // Maximum requests per batch
  maxWait: number;       // Maximum wait time in milliseconds
}

const DEFAULT_CONFIG: BatchConfig = {
  window: 100,          // 100ms batching window
  maxBatchSize: 10,     // Max 10 requests per batch
  maxWait: 500,         // 500ms max wait
};

export class RequestBatcher {
  private queue: Map<string, BatchedRequest[]> = new Map(); // key: table:operation
  private config: BatchConfig;
  private timeouts: Map<string, NodeJS.Timeout> = new Map();

  constructor(config: Partial<BatchConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Add request to batch
   */
  async batch<T>(
    fn: () => Promise<T>,
    options: {
      table?: string;
      operation?: OperationType;
      batchKey?: string;
    } = {}
  ): Promise<T> {
    const { table, operation = 'read', batchKey } = options;
    const key = batchKey || `${table || 'default'}:${operation}`;

    return new Promise<T>((resolve, reject) => {
      const request: BatchedRequest<T> = {
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        fn,
        resolve,
        reject,
        table,
        operation,
        timestamp: Date.now(),
      };

      // Get or create batch for this key
      let batch = this.queue.get(key) || [];
      batch.push(request);
      this.queue.set(key, batch);

      // Check if we should execute immediately
      if (batch.length >= this.config.maxBatchSize) {
        this.executeBatch(key);
      } else {
        // Schedule batch execution
        this.scheduleBatch(key);
      }
    });
  }

  /**
   * Schedule batch execution
   */
  private scheduleBatch(key: string): void {
    // Clear existing timeout
    const existing = this.timeouts.get(key);
    if (existing) {
      clearTimeout(existing);
    }

    const batch = this.queue.get(key);
    if (!batch || batch.length === 0) {
      return;
    }

    // Calculate wait time
    const oldestRequest = batch[0];
    const age = Date.now() - oldestRequest.timestamp;
    const waitTime = Math.min(
      this.config.window - age,
      this.config.maxWait - age,
      this.config.window
    );

    if (waitTime <= 0) {
      // Execute immediately
      this.executeBatch(key);
      return;
    }

    // Schedule execution
    const timeout = setTimeout(() => {
      this.executeBatch(key);
    }, waitTime);

    this.timeouts.set(key, timeout);
  }

  /**
   * Execute a batch of requests
   */
  private async executeBatch(key: string): Promise<void> {
    const batch = this.queue.get(key);
    if (!batch || batch.length === 0) {
      return;
    }

    // Clear timeout
    const timeout = this.timeouts.get(key);
    if (timeout) {
      clearTimeout(timeout);
      this.timeouts.delete(key);
    }

    // Remove batch from queue
    this.queue.delete(key);

    // Group similar requests
    const groups = this.groupSimilarRequests(batch);

    // Execute each group
    for (const group of groups) {
      await this.executeGroup(group);
    }
  }

  /**
   * Group similar requests together
   */
  private groupSimilarRequests(batch: BatchedRequest[]): BatchedRequest[][] {
    const groups: BatchedRequest[][] = [];
    const grouped = new Set<string>();

    for (const request of batch) {
      if (grouped.has(request.id)) {
        continue;
      }

      // Find similar requests (same table and operation)
      const similar = batch.filter(r => 
        !grouped.has(r.id) &&
        r.table === request.table &&
        r.operation === request.operation
      );

      groups.push(similar);
      similar.forEach(r => grouped.add(r.id));
    }

    return groups;
  }

  /**
   * Execute a group of similar requests
   */
  private async executeGroup(group: BatchedRequest[]): Promise<void> {
    // Execute requests in parallel
    const promises = group.map(request => {
      return request.fn()
        .then(result => {
          request.resolve(result);
        })
        .catch(error => {
          request.reject(error);
        });
    });

    await Promise.allSettled(promises);
  }

  /**
   * Clear all pending batches
   */
  clear(): void {
    // Clear timeouts
    for (const timeout of this.timeouts.values()) {
      clearTimeout(timeout);
    }
    this.timeouts.clear();

    // Reject all pending requests
    for (const batch of this.queue.values()) {
      for (const request of batch) {
        request.reject(new Error('Request batcher cleared'));
      }
    }
    this.queue.clear();
  }

  /**
   * Get pending batch count
   */
  getPendingCount(): number {
    let count = 0;
    for (const batch of this.queue.values()) {
      count += batch.length;
    }
    return count;
  }
}

/**
 * Default request batcher instance
 */
export const defaultRequestBatcher = new RequestBatcher();

