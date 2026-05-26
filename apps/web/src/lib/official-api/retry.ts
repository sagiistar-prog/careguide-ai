import type { RetryConfig } from "./types";

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  retries: 2,
  initialDelayMs: 500,
  maxDelayMs: 5_000,
};

export function parseRetryAfterMs(value: string | null) {
  if (!value) {
    return null;
  }

  const seconds = Number(value);
  if (Number.isFinite(seconds)) {
    return Math.max(0, seconds * 1_000);
  }

  const dateMs = Date.parse(value);
  if (Number.isFinite(dateMs)) {
    return Math.max(0, dateMs - Date.now());
  }

  return null;
}

export function getBackoffDelayMs(
  attempt: number,
  config: RetryConfig = DEFAULT_RETRY_CONFIG,
) {
  return Math.min(
    config.maxDelayMs,
    config.initialDelayMs * 2 ** Math.max(0, attempt - 1),
  );
}

export function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
