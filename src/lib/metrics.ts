/**
 * Metrics Collector
 * 
 * Tracks all database operations, success/failure rates, response times,
 * and circuit breaker states for monitoring and analytics.
 */

import { CircuitState } from './circuitBreaker';
import { ErrorCategory } from './errorHandler';
import { OperationType } from './rateLimiter';
import { supabase } from './supabase';

export interface OperationMetric {
  operationType: OperationType;
  endpoint?: string;
  userId?: string | null;
  circuitBreakerState: CircuitState;
  success: boolean;
  errorCategory?: ErrorCategory | string;
  responseTimeMs: number;
  metadata?: Record<string, any>;
}

class MetricsCollector {
  private queue: OperationMetric[] = [];
  private batchSize: number = 50; // Increased to reduce flush frequency
  private batchInterval: number = 30000; // Increased to 30 seconds to reduce load
  private intervalId: NodeJS.Timeout | null = null;
  private enabled: boolean = true;
  private lastFlushTime: number = 0;
  private flushThrottle: number = 10000; // Minimum 10 seconds between flushes

  constructor() {
    // Start batching interval
    if (typeof window !== 'undefined') {
      this.startBatching();
    }
  }

  /**
   * Record an operation metric
   */
  record(metric: OperationMetric): void {
    if (!this.enabled) return;

    // Limit queue size to prevent memory issues
    if (this.queue.length >= 1000) {
      // Drop oldest metrics if queue is too large
      this.queue = this.queue.slice(-500);
    }

    this.queue.push({
      ...metric,
      timestamp: Date.now(),
    } as any);

    // Flush if batch size reached AND enough time has passed since last flush
    const now = Date.now();
    if (this.queue.length >= this.batchSize && (now - this.lastFlushTime) >= this.flushThrottle) {
      this.flush();
    }
  }

  /**
   * Start automatic batching
   */
  private startBatching(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }

    this.intervalId = setInterval(() => {
      this.flush();
    }, this.batchInterval);
  }

  /**
   * Stop batching
   */
  stopBatching(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  /**
   * Flush metrics to database
   */
  async flush(): Promise<void> {
    if (this.queue.length === 0) {
      return;
    }

    const now = Date.now();
    // Throttle flushes to prevent database flooding
    if ((now - this.lastFlushTime) < this.flushThrottle) {
      return;
    }

    const metricsToSend = [...this.queue];
    this.queue = [];
    this.lastFlushTime = now;

    try {
      // Insert metrics in batch
      const { error } = await supabase
        .from('circuit_breaker_metrics')
        .insert(
          metricsToSend.map(metric => ({
            operation_type: metric.operationType,
            endpoint: metric.endpoint || null,
            user_id: metric.userId || null,
            circuit_breaker_state: metric.circuitBreakerState,
            success: metric.success,
            error_category: metric.errorCategory || null,
            response_time_ms: metric.responseTimeMs,
            metadata: metric.metadata || {},
          }))
        );

      if (error) {
        console.warn('Failed to send metrics:', error);
        // Re-queue metrics if send failed (up to a limit)
        if (this.queue.length < 100) {
          this.queue = [...metricsToSend, ...this.queue];
        }
      }
    } catch (error) {
      console.warn('Failed to flush metrics:', error);
      // Re-queue metrics if send failed (up to a limit)
      if (this.queue.length < 100) {
        this.queue = [...metricsToSend, ...this.queue];
      }
    }
  }

  /**
   * Enable/disable metrics collection
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (enabled) {
      this.startBatching();
    } else {
      this.stopBatching();
      this.queue = [];
    }
  }

  /**
   * Get current queue size
   */
  getQueueSize(): number {
    return this.queue.length;
  }

  /**
   * Force flush and return promise
   */
  async forceFlush(): Promise<void> {
    await this.flush();
  }
}

/**
 * Calculate percentile from array of numbers
 */
function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
}

/**
 * Get metrics statistics
 */
export async function getMetricsStats(
  from?: Date,
  to?: Date,
  operationType?: OperationType
): Promise<{
  totalOperations: number;
  successRate: number;
  failureRate: number;
  avgResponseTime: number;
  p50ResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  circuitBreakerStates: Record<string, number>;
  errorCategories: Record<string, number>;
  operationsByType: Record<string, number>;
}> {
  try {
    let query = supabase
      .from('circuit_breaker_metrics')
      .select('*');

    if (from) {
      query = query.gte('created_at', from.toISOString());
    }
    if (to) {
      query = query.lt('created_at', to.toISOString());
    }
    if (operationType) {
      query = query.eq('operation_type', operationType);
    }

    const { data, error } = await query;

    if (error || !data) {
      return {
        totalOperations: 0,
        successRate: 0,
        failureRate: 0,
        avgResponseTime: 0,
        p50ResponseTime: 0,
        p95ResponseTime: 0,
        p99ResponseTime: 0,
        circuitBreakerStates: {},
        errorCategories: {},
        operationsByType: {},
      };
    }

    const total = data.length;
    const successes = data.filter(m => m.success).length;
    const failures = data.filter(m => !m.success).length;
    
    const responseTimes = data
      .map(m => m.response_time_ms || 0)
      .filter(rt => rt > 0);

    const circuitBreakerStates: Record<string, number> = {};
    const errorCategories: Record<string, number> = {};
    const operationsByType: Record<string, number> = {};

    data.forEach((metric: any) => {
      // Count circuit breaker states
      const state = metric.circuit_breaker_state || 'UNKNOWN';
      circuitBreakerStates[state] = (circuitBreakerStates[state] || 0) + 1;

      // Count error categories
      if (metric.error_category) {
        const category = metric.error_category;
        errorCategories[category] = (errorCategories[category] || 0) + 1;
      }

      // Count by operation type
      const opType = metric.operation_type || 'unknown';
      operationsByType[opType] = (operationsByType[opType] || 0) + 1;
    });

    const avgResponseTime = responseTimes.length > 0
      ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
      : 0;

    return {
      totalOperations: total,
      successRate: total > 0 ? successes / total : 0,
      failureRate: total > 0 ? failures / total : 0,
      avgResponseTime,
      p50ResponseTime: percentile(responseTimes, 50),
      p95ResponseTime: percentile(responseTimes, 95),
      p99ResponseTime: percentile(responseTimes, 99),
      circuitBreakerStates,
      errorCategories,
      operationsByType,
    };
  } catch (error) {
    console.error('Failed to get metrics stats:', error);
    return {
      totalOperations: 0,
      successRate: 0,
      failureRate: 0,
      avgResponseTime: 0,
      p50ResponseTime: 0,
      p95ResponseTime: 0,
      p99ResponseTime: 0,
      circuitBreakerStates: {},
      errorCategories: {},
      operationsByType: {},
    };
  }
}

/**
 * Default metrics collector instance
 */
export const defaultMetricsCollector = new MetricsCollector();

