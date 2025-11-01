/**
 * Circuit Breaker Implementation
 * 
 * Prevents cascade failures by monitoring request success/failure rates
 * and temporarily stopping requests when failure threshold is exceeded.
 * 
 * States:
 * - CLOSED: Normal operation, requests flow through
 * - OPEN: Circuit is open, requests fail fast (circuit breaker tripped)
 * - HALF_OPEN: Testing if service recovered, allowing limited requests
 */

export enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN',
}

export interface CircuitBreakerConfig {
  failureThreshold: number;      // Open circuit after N failures
  resetTimeout: number;           // Milliseconds before retry (transition to HALF_OPEN)
  successThreshold: number;       // Close circuit after N successes in HALF_OPEN
  monitoringPeriod: number;       // Time window for counting failures (ms)
  timeout: number;                 // Request timeout in milliseconds
}

export interface CircuitBreakerStats {
  failures: number;
  successes: number;
  state: CircuitState;
  lastFailureTime: number | null;
  lastSuccessTime: number | null;
  stateChangedAt: number;
  totalRequests: number;
}

export type CircuitBreakerEvent = 
  | { type: 'stateChange', from: CircuitState, to: CircuitState }
  | { type: 'failure', error: Error }
  | { type: 'success' }
  | { type: 'timeout' };

type EventListener = (event: CircuitBreakerEvent) => void;

const DEFAULT_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 5,      // Open after 5 failures
  resetTimeout: 30000,      // Wait 30 seconds before retrying
  successThreshold: 2,      // Close after 2 successes
  monitoringPeriod: 10000,   // Count failures in 10 second window
  timeout: 10000,           // 10 second request timeout
};

const STORAGE_PREFIX = 'circuit_breaker_';

export class CircuitBreaker {
  private config: CircuitBreakerConfig;
  private state: CircuitState;
  private failures: Array<{ time: number }> = [];  // Failure timestamps for time-window counting
  private successes: number = 0;
  private stateChangedAt: number;
  private lastFailureTime: number | null = null;
  private lastSuccessTime: number | null = null;
  private totalRequests: number = 0;
  private listeners: EventListener[] = [];
  private storageKey: string;

  constructor(
    public readonly name: string,
    config: Partial<CircuitBreakerConfig> = {}
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.storageKey = `${STORAGE_PREFIX}${name}`;
    this.state = this.loadState() || CircuitState.CLOSED;
    this.stateChangedAt = Date.now();
    this.failures = [];
    this.loadFromStorage();
  }

  /**
   * Execute a function with circuit breaker protection
   */
  async execute<T>(
    fn: () => Promise<T>,
    timeoutMs?: number
  ): Promise<T> {
    this.totalRequests++;
    
    // Check if we should allow the request
    if (!this.canExecute()) {
      const error = new Error(`Circuit breaker is ${this.state}. Request rejected.`);
      (error as any).circuitBreaker = { state: this.state, name: this.name };
      throw error;
    }

    const timeout = timeoutMs || this.config.timeout;
    const startTime = Date.now();

    try {
      // Create a timeout promise
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Request timeout after ${timeout}ms`));
        }, timeout);
      });

      // Race between the function and timeout
      const result = await Promise.race([fn(), timeoutPromise]);
      
      // Request succeeded
      this.recordSuccess();
      return result;
    } catch (error) {
      // Request failed
      const isTimeout = error instanceof Error && error.message.includes('timeout');
      
      if (isTimeout) {
        this.emitEvent({ type: 'timeout' });
      }
      
      this.recordFailure(error as Error);
      throw error;
    }
  }

  /**
   * Check if request can be executed based on current state
   */
  private canExecute(): boolean {
    const now = Date.now();

    switch (this.state) {
      case CircuitState.CLOSED:
        return true;

      case CircuitState.OPEN:
        // Check if reset timeout has passed
        const timeSinceOpen = now - this.stateChangedAt;
        if (timeSinceOpen >= this.config.resetTimeout) {
          this.transitionTo(CircuitState.HALF_OPEN);
          return true; // Allow limited requests in HALF_OPEN
        }
        return false; // Still in cooldown period

      case CircuitState.HALF_OPEN:
        // Only allow requests in HALF_OPEN (limited testing)
        return true;

      default:
        return false;
    }
  }

  /**
   * Record a successful request
   */
  private recordSuccess(): void {
    this.lastSuccessTime = Date.now();
    this.emitEvent({ type: 'success' });

    // In HALF_OPEN state, count successes to potentially close circuit
    if (this.state === CircuitState.HALF_OPEN) {
      this.successes++;
      
      if (this.successes >= this.config.successThreshold) {
        // Service has recovered, close the circuit
        this.transitionTo(CircuitState.CLOSED);
        this.successes = 0; // Reset success counter
        this.failures = []; // Clear failure history
      }
    }

    this.saveToStorage();
  }

  /**
   * Record a failed request
   */
  private recordFailure(error: Error): void {
    const now = Date.now();
    this.lastFailureTime = now;
    this.emitEvent({ type: 'failure', error });

    // Add failure to time-windowed list
    this.failures.push({ time: now });

    // Remove failures outside the monitoring window
    const cutoff = now - this.config.monitoringPeriod;
    this.failures = this.failures.filter(f => f.time > cutoff);

    // Check if we should open the circuit
    if (this.state === CircuitState.CLOSED || this.state === CircuitState.HALF_OPEN) {
      if (this.failures.length >= this.config.failureThreshold) {
        // Too many failures, open the circuit
        this.transitionTo(CircuitState.OPEN);
        this.successes = 0; // Reset success counter
      }
    }

    // In HALF_OPEN, any failure immediately opens the circuit again
    if (this.state === CircuitState.HALF_OPEN) {
      this.transitionTo(CircuitState.OPEN);
      this.successes = 0;
    }

    this.saveToStorage();
  }

  /**
   * Transition to a new state
   */
  private transitionTo(newState: CircuitState): void {
    if (this.state === newState) return;

    const fromState = this.state;
    this.state = newState;
    this.stateChangedAt = Date.now();

    this.emitEvent({
      type: 'stateChange',
      from: fromState,
      to: newState,
    });

    this.saveToStorage();
  }

  /**
   * Get current statistics
   */
  getStats(): CircuitBreakerStats {
    return {
      failures: this.failures.length,
      successes: this.successes,
      state: this.state,
      lastFailureTime: this.lastFailureTime,
      lastSuccessTime: this.lastSuccessTime,
      stateChangedAt: this.stateChangedAt,
      totalRequests: this.totalRequests,
    };
  }

  /**
   * Get current state
   */
  getState(): CircuitState {
    return this.state;
  }

  /**
   * Get current configuration
   */
  getConfig(): CircuitBreakerConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<CircuitBreakerConfig>): void {
    this.config = { ...this.config, ...newConfig };
    // Save config to localStorage
    try {
      if (typeof localStorage !== 'undefined') {
        const existingData = localStorage.getItem(this.storageKey);
        const data = existingData ? JSON.parse(existingData) : {};
        data.config = this.config;
        localStorage.setItem(this.storageKey, JSON.stringify(data));
      }
    } catch (error) {
      console.warn('Failed to save circuit breaker config:', error);
    }
  }

  /**
   * Manually reset the circuit breaker (admin override)
   */
  reset(): void {
    this.transitionTo(CircuitState.CLOSED);
    this.failures = [];
    this.successes = 0;
    this.lastFailureTime = null;
    this.lastSuccessTime = null;
    this.totalRequests = 0;
    this.saveToStorage();
  }

  /**
   * Manually open the circuit (emergency)
   */
  open(): void {
    this.transitionTo(CircuitState.OPEN);
  }

  /**
   * Subscribe to circuit breaker events
   */
  on(event: 'stateChange' | 'failure' | 'success' | 'timeout', listener: EventListener): void {
    this.listeners.push(listener);
  }

  /**
   * Unsubscribe from events
   */
  off(listener: EventListener): void {
    this.listeners = this.listeners.filter(l => l !== listener);
  }

  /**
   * Emit event to all listeners
   */
  private emitEvent(event: CircuitBreakerEvent): void {
    this.listeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        console.error('Circuit breaker event listener error:', error);
      }
    });
  }

  /**
   * Save state to localStorage
   */
  private saveToStorage(): void {
    try {
      if (typeof localStorage !== 'undefined') {
        const data = {
          state: this.state,
          stateChangedAt: this.stateChangedAt,
          failures: this.failures,
          successes: this.successes,
          lastFailureTime: this.lastFailureTime,
          lastSuccessTime: this.lastSuccessTime,
          totalRequests: this.totalRequests,
        };
        localStorage.setItem(this.storageKey, JSON.stringify(data));
      }
    } catch (error) {
      console.warn('Failed to save circuit breaker state:', error);
    }
  }

  /**
   * Load state from localStorage
   */
  private loadState(): CircuitState | null {
    try {
      if (typeof localStorage !== 'undefined') {
        const data = localStorage.getItem(this.storageKey);
        if (data) {
          const parsed = JSON.parse(data);
          return parsed.state as CircuitState;
        }
      }
    } catch (error) {
      console.warn('Failed to load circuit breaker state:', error);
    }
    return null;
  }

  /**
   * Load full state from localStorage
   */
  private loadFromStorage(): void {
    try {
      if (typeof localStorage !== 'undefined') {
        const data = localStorage.getItem(this.storageKey);
        if (data) {
          const parsed = JSON.parse(data);
          
          // Load config if it exists in storage, otherwise use current config
          if (parsed.config) {
            this.config = { ...this.config, ...parsed.config };
          }
          
          this.state = parsed.state || CircuitState.CLOSED;
          this.stateChangedAt = parsed.stateChangedAt || Date.now();
          this.failures = (parsed.failures || []).filter((f: any) => {
            // Only keep failures within monitoring window
            const cutoff = Date.now() - this.config.monitoringPeriod;
            return f.time > cutoff;
          });
          this.successes = parsed.successes || 0;
          this.lastFailureTime = parsed.lastFailureTime || null;
          this.lastSuccessTime = parsed.lastSuccessTime || null;
          this.totalRequests = parsed.totalRequests || 0;

          // Check if we should transition from OPEN to HALF_OPEN based on elapsed time
          if (this.state === CircuitState.OPEN) {
            const timeSinceOpen = Date.now() - this.stateChangedAt;
            if (timeSinceOpen >= this.config.resetTimeout) {
              this.transitionTo(CircuitState.HALF_OPEN);
            }
          }
        }
      }
    } catch (error) {
      console.warn('Failed to load circuit breaker state:', error);
    }
  }
}

/**
 * Circuit breaker instance for database operations
 */
export const databaseCircuitBreaker = new CircuitBreaker('database', {
  failureThreshold: 5,
  resetTimeout: 30000,
  successThreshold: 2,
  monitoringPeriod: 10000,
  timeout: 10000,
});

