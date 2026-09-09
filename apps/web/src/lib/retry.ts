/**
 * Retry utility for network requests with exponential backoff.
 * Handles 502, 503, 504, 429 (rate limit) and network errors.
 */

export interface RetryOptions {
  maxRetries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  retryableStatuses?: number[];
  onRetry?: (attempt: number, error: Error, delay: number) => void;
}

const DEFAULT_RETRYABLE_STATUSES = [429, 500, 502, 503, 504];
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_BASE_DELAY_MS = 1000;
const DEFAULT_MAX_DELAY_MS = 10000;

function isRetryableError(error: unknown, retryableStatuses: number[]): boolean {
  if (error instanceof TypeError && error.message.includes('fetch')) {
    return true; // Network error
  }
  if (error instanceof Response) {
    return retryableStatuses.includes(error.status);
  }
  if (error && typeof error === 'object' && 'status' in error) {
    const status = (error as { status: number }).status;
    return retryableStatuses.includes(status);
  }
  return false;
}

function calculateDelay(attempt: number, baseDelayMs: number, maxDelayMs: number): number {
  const delay = baseDelayMs * Math.pow(2, attempt);
  const jitter = Math.random() * 0.3 * delay; // 0-30% jitter
  return Math.min(delay + jitter, maxDelayMs);
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxRetries = DEFAULT_MAX_RETRIES,
    baseDelayMs = DEFAULT_BASE_DELAY_MS,
    maxDelayMs = DEFAULT_MAX_DELAY_MS,
    retryableStatuses = DEFAULT_RETRYABLE_STATUSES,
    onRetry,
  } = options;

  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (attempt === maxRetries) {
        break;
      }

      if (!isRetryableError(error, retryableStatuses)) {
        throw error;
      }

      const delay = calculateDelay(attempt, baseDelayMs, maxDelayMs);
      onRetry?.(attempt + 1, error as Error, delay);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

export async function fetchWithRetry(
  url: string,
  init?: RequestInit,
  options: RetryOptions = {}
): Promise<Response> {
  return withRetry(
    async () => {
      const response = await fetch(url, init);
      if (options.retryableStatuses?.includes(response.status) ?? DEFAULT_RETRYABLE_STATUSES.includes(response.status)) {
        // Create an error-like object with status for isRetryableError
        const error = new Error(`HTTP ${response.status}`) as Error & { status: number };
        error.status = response.status;
        throw error;
      }
      return response;
    },
    options
  );
}

export function createApiClient(baseUrl: string) {
  return {
    async get<T>(path: string, init?: RequestInit): Promise<T> {
      const response = await fetchWithRetry(`${baseUrl}${path}`, { ...init, method: 'GET' });
      return response.json();
    },
    async post<T>(path: string, body: unknown, init?: RequestInit): Promise<T> {
      const response = await fetchWithRetry(`${baseUrl}${path}`, {
        ...init,
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...init?.headers },
        body: JSON.stringify(body),
      });
      return response.json();
    },
    async put<T>(path: string, body: unknown, init?: RequestInit): Promise<T> {
      const response = await fetchWithRetry(`${baseUrl}${path}`, {
        ...init,
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...init?.headers },
        body: JSON.stringify(body),
      });
      return response.json();
    },
    async delete<T>(path: string, init?: RequestInit): Promise<T> {
      const response = await fetchWithRetry(`${baseUrl}${path}`, { ...init, method: 'DELETE' });
      return response.json();
    },
  };
}