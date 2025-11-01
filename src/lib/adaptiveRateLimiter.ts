/**
 * Adaptive Rate Limiter
 * 
 * Dynamically adjusts rate limits based on system health
 * and response times.
 */

import { RateLimiter, RateLimitConfig, RateLimitResult, OperationType } from './rateLimiter';
import { getMetricsStats } from './metrics';

// Re-export types for convenience
export type { OperationType, RateLimitResult, RateLimitConfig };

export interface AdaptiveConfig {
  baseConfig: Record<OperationType, RateLimitConfig>;
  minMultiplier: number;    // Minimum multiplier (e.g., 0.5 = 50% of base)
  maxMultiplier: number;    // Maximum multiplier (e.g., 2.0 = 200% of base)
  adjustmentInterval: number; // How often to check and adjust (ms)
  healthyLatencyThreshold: number; // Response time considered healthy (ms)
  stressLatencyThreshold: number;  // Response time considered stressed (ms)
}

const DEFAULT_CONFIG: AdaptiveConfig = {
  baseConfig: {
    read: { limit: 100, window: 60000 },
    write: { limit: 30, window: 60000 },
    rpc: { limit: 20, window: 60000 },
    auth: { limit: 10, window: 60000 },
  },
  minMultiplier: 0.5,        // Can reduce to 50%
  maxMultiplier: 2.0,         // Can increase to 200%
  adjustmentInterval: 60000,  // Check every minute
  healthyLatencyThreshold: 200,  // < 200ms is healthy
  stressLatencyThreshold: 1000,  // > 1000ms is stressed
};

export class AdaptiveRateLimiter {
  private config: AdaptiveConfig;
  private currentMultipliers: Map<OperationType, number> = new Map();
  private lastAdjustment: number = Date.now();
  private rateLimiters: Map<OperationType, RateLimiter> = new Map();
  private storageKey: string = 'adaptive_rate_limiter';
  private adjustmentIntervalId: NodeJS.Timeout | null = null;

  constructor(config: Partial<AdaptiveConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.loadFromStorage();
    
    // Initialize multipliers to 1.0 (100% of base) if not loaded
    Object.keys(this.config.baseConfig).forEach(op => {
      if (!this.currentMultipliers.has(op as OperationType)) {
        this.currentMultipliers.set(op as OperationType, 1.0);
      }
    });

    // Start adaptive adjustment loop
    if (typeof window !== 'undefined') {
      this.adjustmentIntervalId = setInterval(() => this.adjustLimits(), this.config.adjustmentInterval);
    }
  }

  /**
   * Get rate limiter for operation type (with current adaptive limits)
   */
  getLimiter(operation: OperationType): RateLimiter {
    if (!this.rateLimiters.has(operation)) {
      const baseConfig = this.config.baseConfig[operation];
      const multiplier = this.currentMultipliers.get(operation) || 1.0;
      
      const adaptedConfig: RateLimitConfig = {
        limit: Math.round(baseConfig.limit * multiplier),
        window: baseConfig.window,
      };

      this.rateLimiters.set(
        operation,
        new RateLimiter(`adaptive_${operation}`, { [operation]: adaptedConfig })
      );
    }

    return this.rateLimiters.get(operation)!;
  }

  /**
   * Adjust rate limits based on system health
   */
  private async adjustLimits(): Promise<void> {
    try {
      // Get recent metrics (last 5 minutes)
      const now = Date.now();
      const fiveMinutesAgo = new Date(now - 5 * 60 * 1000);

      // This would call the metrics system - simplified for now
      // In production, you'd query the metrics table or use real-time stats
      const stats = await this.getRecentStats(fiveMinutesAgo, new Date(now));

      // Adjust each operation type
      for (const operation of Object.keys(this.config.baseConfig) as OperationType[]) {
        await this.adjustOperationLimit(operation, stats);
      }

      this.lastAdjustment = now;
    } catch (error) {
      console.warn('Failed to adjust rate limits:', error);
    }
  }

  /**
   * Get recent statistics
   */
  private async getRecentStats(from: Date, to: Date): Promise<{
    avgResponseTime: number;
    errorRate: number;
    requestVolume: number;
  }> {
    // Query metrics from database or use metrics collector
    try {
      const stats = await getMetricsStats(from, to);
      return {
        avgResponseTime: stats.avgResponseTime,
        errorRate: stats.failureRate,
        requestVolume: stats.totalOperations,
      };
    } catch {
      // Fallback to neutral values if metrics unavailable
      return {
        avgResponseTime: 300,
        errorRate: 0.01,
        requestVolume: 100,
      };
    }
  }

  /**
   * Adjust limit for specific operation type
   */
  private async adjustOperationLimit(
    operation: OperationType,
    stats: { avgResponseTime: number; errorRate: number; requestVolume: number }
  ): Promise<void> {
    const currentMultiplier = this.currentMultipliers.get(operation) || 1.0;
    const baseConfig = this.config.baseConfig[operation];
    let newMultiplier = currentMultiplier;

    // Determine adjustment based on metrics
    const { avgResponseTime, errorRate } = stats;

    // If system is healthy (low latency, low errors)
    if (avgResponseTime < this.config.healthyLatencyThreshold && errorRate < 0.05) {
      // Gradually increase limit (max 10% per adjustment)
      newMultiplier = Math.min(
        currentMultiplier * 1.1,
        this.config.maxMultiplier
      );
    }
    // If system is stressed (high latency, high errors)
    else if (avgResponseTime > this.config.stressLatencyThreshold || errorRate > 0.2) {
      // Gradually decrease limit (max 20% per adjustment)
      newMultiplier = Math.max(
        currentMultiplier * 0.8,
        this.config.minMultiplier
      );
    }
    // Otherwise, slowly trend back to 1.0
    else {
      if (currentMultiplier > 1.0) {
        newMultiplier = Math.max(currentMultiplier * 0.95, 1.0);
      } else if (currentMultiplier < 1.0) {
        newMultiplier = Math.min(currentMultiplier * 1.05, 1.0);
      }
    }

    // Update multiplier
    this.currentMultipliers.set(operation, newMultiplier);

    // Create new limiter with adjusted limits
    const adaptedConfig: RateLimitConfig = {
      limit: Math.round(baseConfig.limit * newMultiplier),
      window: baseConfig.window,
    };

    this.rateLimiters.set(
      operation,
      new RateLimiter(`adaptive_${operation}`, { [operation]: adaptedConfig })
    );
    
    // Save to storage after adjustment
    this.saveToStorage();
  }

  /**
   * Get current multiplier for operation
   */
  getMultiplier(operation: OperationType): number {
    return this.currentMultipliers.get(operation) || 1.0;
  }

  /**
   * Get current effective limit
   */
  getEffectiveLimit(operation: OperationType): number {
    const baseConfig = this.config.baseConfig[operation];
    const multiplier = this.currentMultipliers.get(operation) || 1.0;
    return Math.round(baseConfig.limit * multiplier);
  }

  /**
   * Reset to base limits
   */
  reset(): void {
    Object.keys(this.config.baseConfig).forEach(op => {
      this.currentMultipliers.set(op as OperationType, 1.0);
      this.rateLimiters.delete(op as OperationType);
    });
    this.saveToStorage();
  }

  /**
   * Get current configuration
   */
  getConfig(): AdaptiveConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<AdaptiveConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    // Restart adjustment interval if it changed
    if (newConfig.adjustmentInterval && typeof window !== 'undefined') {
      if (this.adjustmentIntervalId) {
        clearInterval(this.adjustmentIntervalId);
      }
      this.adjustmentIntervalId = setInterval(() => this.adjustLimits(), this.config.adjustmentInterval);
    }
    
    // Reset rate limiters to use new base config
    this.rateLimiters.clear();
    
    this.saveToStorage();
  }

  /**
   * Check rate limit (delegates to appropriate limiter)
   */
  checkLimit(
    userId: string | null,
    operation: OperationType,
    endpoint?: string
  ): RateLimitResult {
    const limiter = this.getLimiter(operation);
    return limiter.checkLimit(userId, operation, endpoint);
  }

  /**
   * Record request (delegates to appropriate limiter)
   */
  recordRequest(
    userId: string | null,
    operation: OperationType,
    endpoint?: string
  ): void {
    const limiter = this.getLimiter(operation);
    limiter.recordRequest(userId, operation, endpoint);
  }

  /**
   * Get usage (delegates to appropriate limiter)
   */
  getUsage(
    userId: string | null,
    operation: OperationType,
    endpoint?: string
  ): { count: number; limit: number; resetAt: number } {
    const limiter = this.getLimiter(operation);
    return limiter.getUsage(userId, operation, endpoint);
  }

  /**
   * Save to localStorage
   */
  private saveToStorage(): void {
    try {
      if (typeof localStorage !== 'undefined') {
        const data = {
          config: this.config,
          multipliers: Object.fromEntries(this.currentMultipliers),
          lastAdjustment: this.lastAdjustment,
        };
        localStorage.setItem(this.storageKey, JSON.stringify(data));
      }
    } catch (error) {
      console.warn('Failed to save adaptive rate limiter config:', error);
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
          const parsed = JSON.parse(data);
          
          // Load config
          if (parsed.config) {
            this.config = { ...DEFAULT_CONFIG, ...parsed.config };
          }
          
          // Load multipliers
          if (parsed.multipliers) {
            Object.entries(parsed.multipliers).forEach(([op, mult]) => {
              this.currentMultipliers.set(op as OperationType, mult as number);
            });
          }
          
          // Load last adjustment time
          if (parsed.lastAdjustment) {
            this.lastAdjustment = parsed.lastAdjustment;
          }
        }
      }
    } catch (error) {
      console.warn('Failed to load adaptive rate limiter config:', error);
    }
  }
}

/**
 * Default adaptive rate limiter instance
 */
export const defaultAdaptiveRateLimiter = new AdaptiveRateLimiter();

