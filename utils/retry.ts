import { HttpError } from "./api.ts";

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

interface RetryOptions {
  initialDelayMs?: number;
  maxDurationMs?: number;
}

const RATE_LIMIT_STATUS = 429;
// Fallback when a 429 doesn't carry a Retry-After header - Riot's rate
// limit windows run well past a normal backoff delay, so wait longer.
const DEFAULT_RATE_LIMIT_DELAY_MS = 30_000;

// Retries fn with exponentially increasing delays until it succeeds or
// maxDurationMs has elapsed since the first attempt, then throws the
// last error. A 429 (rate limited) extends the wait to whichever is
// longer: the normal backoff delay, or the server's Retry-After header.
export async function withRetry<T>(
  fn: () => Promise<T>,
  { initialDelayMs = 5000, maxDurationMs = 5 * 60 * 1000 }: RetryOptions = {},
): Promise<T> {
  const start = Date.now();
  let delay = initialDelayMs;

  while (true) {
    try {
      return await fn();
    } catch (err) {
      let nextDelay = delay;
      if (err instanceof HttpError && err.status === RATE_LIMIT_STATUS) {
        nextDelay = Math.max(
          delay,
          err.retryAfterMs ?? DEFAULT_RATE_LIMIT_DELAY_MS,
        );
      }

      const elapsed = Date.now() - start;
      if (elapsed + nextDelay > maxDurationMs) throw err;

      await sleep(nextDelay);
      delay = nextDelay * 2;
    }
  }
}
