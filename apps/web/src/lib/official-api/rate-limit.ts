import type { RateLimitConfig } from "./types";

const lastRequestAt = new Map<string, number>();

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function applyRateLimit(config?: RateLimitConfig) {
  if (!config) {
    return;
  }

  const now = Date.now();
  const previous = lastRequestAt.get(config.key) ?? 0;
  const waitFor = previous + config.minIntervalMs - now;

  if (waitFor > 0) {
    await wait(waitFor);
  }

  lastRequestAt.set(config.key, Date.now());
}
