/**
 * Error Handler and Classifier
 * 
 * Categorizes Supabase errors to determine retry strategies
 */

export enum ErrorCategory {
  NETWORK = 'NETWORK',           // Network issues - retryable
  TIMEOUT = 'TIMEOUT',           // Request timeout - retryable
  DATABASE_ERROR = 'DATABASE_ERROR', // Database errors - may be retryable
  AUTH_ERROR = 'AUTH_ERROR',     // Authentication errors - non-retryable
  VALIDATION_ERROR = 'VALIDATION_ERROR', // Validation errors - non-retryable
  RATE_LIMIT = 'RATE_LIMIT',     // Rate limit - retryable after delay
  UNKNOWN = 'UNKNOWN',           // Unknown errors - may be retryable
}

export interface ClassifiedError {
  category: ErrorCategory;
  isRetryable: boolean;
  retryDelay?: number;  // Milliseconds to wait before retry
  userMessage: string;
  originalError: any;
}

/**
 * Supabase error codes that indicate network issues
 */
const NETWORK_ERROR_CODES = [
  'ECONNRESET',
  'ENOTFOUND',
  'ETIMEDOUT',
  'ECONNREFUSED',
  'NetworkError',
];

/**
 * Supabase error codes that indicate timeout
 */
const TIMEOUT_ERROR_CODES = [
  'Timeout',
  'ETIMEDOUT',
];

/**
 * Supabase HTTP status codes for errors
 */
const HTTP_RETRYABLE_STATUS = [500, 502, 503, 504, 429];
const HTTP_NON_RETRYABLE_STATUS = [400, 401, 403, 404];

/**
 * Classify a Supabase error
 */
export function classifyError(error: any): ClassifiedError {
  const errorMessage = error?.message || String(error);
  const errorCode = error?.code || error?.error_code || '';
  const errorStatus = error?.status || error?.statusCode || error?.response?.status;

  // Check for network errors
  if (
    NETWORK_ERROR_CODES.some(code => 
      errorMessage.includes(code) || 
      errorCode.includes(code) ||
      errorMessage.toLowerCase().includes('network')
    )
  ) {
    return {
      category: ErrorCategory.NETWORK,
      isRetryable: true,
      retryDelay: 1000,
      userMessage: 'Koneksi jaringan bermasalah. Mencoba lagi...',
      originalError: error,
    };
  }

  // Check for timeout errors
  if (
    TIMEOUT_ERROR_CODES.some(code => 
      errorMessage.includes(code) || 
      errorCode.includes(code) ||
      errorMessage.toLowerCase().includes('timeout')
    )
  ) {
    return {
      category: ErrorCategory.TIMEOUT,
      isRetryable: true,
      retryDelay: 2000,
      userMessage: 'Permintaan memakan waktu terlalu lama. Mencoba lagi...',
      originalError: error,
    };
  }

  // Check for rate limiting
  if (
    errorStatus === 429 ||
    errorMessage.includes('rate limit') ||
    errorMessage.includes('too many requests') ||
    errorCode === 'PGRST301'
  ) {
    return {
      category: ErrorCategory.RATE_LIMIT,
      isRetryable: true,
      retryDelay: 5000,  // Wait 5 seconds for rate limit
      userMessage: 'Terlalu banyak permintaan. Mohon tunggu sebentar...',
      originalError: error,
    };
  }

  // Check for authentication errors
  if (
    errorStatus === 401 ||
    errorStatus === 403 ||
    errorMessage.includes('JWT') ||
    errorMessage.includes('token') ||
    errorMessage.includes('unauthorized') ||
    errorMessage.includes('forbidden') ||
    errorCode === 'PGRST301' ||
    errorCode === 'PGRST302'
  ) {
    return {
      category: ErrorCategory.AUTH_ERROR,
      isRetryable: false,
      userMessage: 'Sesi Anda telah berakhir. Silakan login kembali.',
      originalError: error,
    };
  }

  // Check for validation errors (400)
  if (
    errorStatus === 400 ||
    errorMessage.includes('validation') ||
    errorMessage.includes('invalid') ||
    errorMessage.includes('constraint') ||
    errorCode === '23505' || // Unique constraint violation
    errorCode === '23503' || // Foreign key violation
    errorCode === '23514'    // Check constraint violation
  ) {
    return {
      category: ErrorCategory.VALIDATION_ERROR,
      isRetryable: false,
      userMessage: 'Data yang dimasukkan tidak valid. Silakan periksa kembali.',
      originalError: error,
    };
  }

  // Check for database errors (5xx or specific codes)
  if (
    HTTP_RETRYABLE_STATUS.includes(errorStatus) ||
    errorCode?.startsWith('PGRST') ||
    errorCode?.startsWith('P0001') || // Exception code
    errorMessage.includes('database') ||
    errorMessage.includes('connection')
  ) {
    // Some database errors are retryable (5xx), others are not
    const isRetryable = errorStatus >= 500 || errorStatus === 429;
    
    return {
      category: ErrorCategory.DATABASE_ERROR,
      isRetryable,
      retryDelay: isRetryable ? 2000 : undefined,
      userMessage: isRetryable 
        ? 'Database sedang bermasalah. Mencoba lagi...'
        : 'Terjadi kesalahan database. Silakan coba lagi nanti.',
      originalError: error,
    };
  }

  // Check for 404 (not found) - non-retryable
  if (errorStatus === 404) {
    return {
      category: ErrorCategory.VALIDATION_ERROR,
      isRetryable: false,
      userMessage: 'Data yang dicari tidak ditemukan.',
      originalError: error,
    };
  }

  // Unknown error - default to retryable with caution
  return {
    category: ErrorCategory.UNKNOWN,
    isRetryable: true,
    retryDelay: 1000,
    userMessage: 'Terjadi kesalahan. Mencoba lagi...',
    originalError: error,
  };
}

/**
 * Check if error is retryable
 */
export function isRetryableError(error: any): boolean {
  return classifyError(error).isRetryable;
}

/**
 * Get retry delay for error (in milliseconds)
 */
export function getRetryDelay(error: any): number {
  const classified = classifyError(error);
  return classified.retryDelay || 1000;
}

/**
 * Get user-friendly error message
 */
export function getUserFriendlyMessage(error: any): string {
  return classifyError(error).userMessage;
}

/**
 * Check if error indicates circuit breaker should open
 */
export function shouldOpenCircuit(error: any): boolean {
  const classified = classifyError(error);
  
  // Open circuit for network/timeout/database errors (persistent failures)
  // Don't open for auth/validation errors (these are expected in normal operation)
  return classified.isRetryable && 
    (classified.category === ErrorCategory.NETWORK ||
     classified.category === ErrorCategory.TIMEOUT ||
     classified.category === ErrorCategory.DATABASE_ERROR);
}

