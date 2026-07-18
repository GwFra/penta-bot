const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Retries fn with exponentially increasing delays until it succeeds or
// maxDurationMs has elapsed since the first attempt, then throws the
// last error.
export async function withRetry(
  fn,
  { initialDelayMs = 5000, maxDurationMs = 5 * 60 * 1000 } = {},
) {
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
