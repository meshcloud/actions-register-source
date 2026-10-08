import { AxiosError, isAxiosError } from 'axios';
import { formatAxiosError } from './error-utils';

// meshStack answers these, or does not answer at all, for a few minutes while it is being updated.
const RETRYABLE_STATUSES = [502, 503, 504];
const RETRYABLE_NETWORK_ERROR_CODES = ['ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'ECONNABORTED', 'EPIPE', 'EAI_AGAIN', 'ERR_NETWORK'];

export const REQUEST_TIMEOUT_MS = 30_000;
const RETRY_BUDGET_MS = 10 * 60_000;
const INITIAL_DELAY_MS = 2_000;
const MAX_DELAY_MS = 60_000;

export interface RetryOptions {
  warning: (message: string) => void;
  budgetMs?: number;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
}

function isRetryable(error: AxiosError): boolean {
  if (error.response) {
    return RETRYABLE_STATUSES.includes(error.response.status);
  }
  return error.code !== undefined && RETRYABLE_NETWORK_ERROR_CODES.includes(error.code);
}

function retryDelayMs(failedAttempt: number): number {
  return Math.min(INITIAL_DELAY_MS * 2 ** (failedAttempt - 1), MAX_DELAY_MS);
}

/**
 * Calls `request` until it succeeds, fails with an error that is not retryable, or the next attempt would start
 * after the retry budget. Throws the last error unchanged.
 */
export async function withRetry<T>(request: (attempt: number) => Promise<T>, options: RetryOptions): Promise<T> {
  const {
    warning,
    budgetMs = RETRY_BUDGET_MS,
    sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms)),
    now = Date.now
  } = options;
  const deadline = now() + budgetMs;

  for (let attempt = 1; ; attempt++) {
    try {
      return await request(attempt);
    } catch (error) {
      if (!isAxiosError(error) || !isRetryable(error)) {
        if (attempt > 1) {
          warning(`Attempt ${attempt} failed with an error that is not retried. An earlier attempt may have reached meshStack.`);
        }
        throw error;
      }
      const delayMs = retryDelayMs(attempt);
      if (now() + delayMs >= deadline) {
        warning(`Attempt ${attempt} failed and the retry budget of ${budgetMs / 1000}s is used up.`);
        throw error;
      }
      warning(`Attempt ${attempt} failed (${formatAxiosError(error)}). Retrying in ${delayMs / 1000}s.`);
      await sleep(delayMs);
    }
  }
}
