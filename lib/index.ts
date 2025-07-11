export interface RetryOptions {
  errors?: string[];
  intervals?: number;
  backoff?: number;
  maxAttempts?: number;
  maxInterval?: number;
  jitter?: boolean;
}

type AsyncFunction<T extends any[], R> = (...args: T) => Promise<R>;
type SyncFunction<T extends any[], R> = (...args: T) => R;
type AnyFunction<T extends any[], R> = AsyncFunction<T, R> | SyncFunction<T, R>;

/**
 * Creates a promise that resolves after the specified delay
 */

const delay = (ms: number): Promise<void> => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

/**
 * Determines if an error should trigger a retry based on allowed error types
 */

const shouldRetryError = (error: Error, allowedErrors?: string[]): boolean => {
  if (!allowedErrors || allowedErrors.length === 0) {
    return true;
  }
  return allowedErrors.includes(error.name);
};

/**
 * Calculates the delay for the next retry attempt using exponential backoff
 * with optional jitter and maximum interval capping
 */

const calculateDelay = (
  baseInterval: number,
  backoff: number,
  attempt: number,
  maxInterval?: number,
  jitter?: boolean
): number => {
  // Calculate exponential backoff delay
  let delayMs = baseInterval * Math.pow(backoff, attempt);

  // Apply jitter to spread out retry attempts (±20% variation)
  if (jitter) {
    const jitterFactor = 0.8 + Math.random() * 0.4;
    delayMs = delayMs * jitterFactor;
  }

  // Cap the delay at maxInterval if specified
  if (maxInterval !== undefined) {
    delayMs = Math.min(delayMs, maxInterval);
  }

  return delayMs;
};

/**
 * Wraps a function with retry logic using exponential backoff
 * Returns an async function that retries on failure
 */

export default <T extends any[], R>(
  fn: AnyFunction<T, R>,
  options: RetryOptions = {}
): AsyncFunction<T, R> => {
  // Extract options with defaults - optimized for V8 JIT
  const errors = options.errors;
  const intervals = options.intervals ?? 1000;
  const backoff = options.backoff ?? 2;
  const maxAttempts = options.maxAttempts ?? 3;
  const maxInterval = options.maxInterval;
  const jitter = options.jitter ?? false;

  return async (...args: T): Promise<R> => {
    let lastError: Error;

    // Retry loop with exponential backoff
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const result = await fn(...args);
        return result;
      } catch (error) {
        // Normalize error to Error instance
        lastError = error instanceof Error ? error : new Error(String(error));

        // Check if this error type should trigger a retry
        if (!shouldRetryError(lastError, errors)) {
          throw lastError;
        }

        // Don't delay after the last attempt
        if (attempt === maxAttempts - 1) {
          throw lastError;
        }

        // Calculate delay and wait before next attempt
        const currentInterval = calculateDelay(
          intervals,
          backoff,
          attempt,
          maxInterval,
          jitter
        );
        await delay(currentInterval);
      }
    }

    // This should never be reached, but TypeScript requires it
    throw lastError!;
  };
};
