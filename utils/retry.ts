const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

interface RetryOptions {
  initialDelayMs?: number;
  maxDurationMs?: number;
}

// Retries fn with exponentially increasing delays until it succeeds or
// maxDurationMs has elapsed since the first attempt, then throws the
// last error.
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
      const elapsed = Date.now() - start;
      if (elapsed + delay > maxDurationMs) throw err;

      await sleep(delay);
      delay *= 2;
    }
  }
}
