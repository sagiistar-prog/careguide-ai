import { OfficialApiError, toSafeErrorMessage } from "./errors";
import { applyRateLimit } from "./rate-limit";
import {
  DEFAULT_RETRY_CONFIG,
  getBackoffDelayMs,
  parseRetryAfterMs,
  wait,
} from "./retry";
import type {
  OfficialApiFailure,
  OfficialApiRequest,
  OfficialApiResult,
  QueryParams,
} from "./types";

const DEFAULT_TIMEOUT_MS = 15_000;

function appendQueryParams(url: URL, query?: QueryParams) {
  if (!query) {
    return;
  }

  Object.entries(query).forEach(([key, value]) => {
    if (value == null) {
      return;
    }

    if (Array.isArray(value)) {
      value.forEach((item) => url.searchParams.append(key, String(item)));
      return;
    }

    url.searchParams.set(key, String(value));
  });
}

function buildUrl(baseUrl: string, path: string, query?: QueryParams) {
  const url = new URL(path, baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`);
  appendQueryParams(url, query);
  return url;
}

function sanitizeUrl(url: URL) {
  const clone = new URL(url.toString());
  const sensitiveParams = ["api_key", "apikey", "key", "subscription-key"];

  sensitiveParams.forEach((param) => {
    if (clone.searchParams.has(param)) {
      clone.searchParams.set(param, "[redacted]");
    }
  });

  return clone.toString();
}

function isRetryableStatus(status: number) {
  return status === 429 || status >= 500;
}

function toFailure(input: {
  request: OfficialApiRequest;
  sanitizedUrl?: string;
  status?: number;
  code: string;
  message: string;
  retryable: boolean;
  retryCount: number;
}): OfficialApiFailure {
  return {
    ok: false,
    source: input.request.source,
    status: input.status,
    error: {
      code: input.code,
      message: input.message,
      retryable: input.retryable,
    },
    meta: {
      sanitizedUrl: input.sanitizedUrl,
      importRunId: input.request.importRunId,
      retryCount: input.retryCount,
    },
  };
}

async function fetchWithTimeout(request: OfficialApiRequest, url: URL) {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    request.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  );

  try {
    return await fetch(url, {
      method: request.method ?? "GET",
      headers: request.headers,
      signal: controller.signal,
      cache: "no-store",
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number) {
  let timeout: ReturnType<typeof setTimeout> | undefined;

  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeout = setTimeout(() => {
          reject(new Error(`Official API request timed out after ${timeoutMs}ms.`));
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
}

export async function requestOfficialJson<T>(
  request: OfficialApiRequest,
): Promise<OfficialApiResult<T>> {
  const url = buildUrl(request.baseUrl, request.path, request.query);
  const sanitizedUrl = sanitizeUrl(url);
  const retry = request.retry ?? DEFAULT_RETRY_CONFIG;
  let retryCount = 0;

  for (let attempt = 0; attempt <= retry.retries; attempt += 1) {
    try {
      await applyRateLimit(request.rateLimit);
      const response = await fetchWithTimeout(request, url);

      if (!response.ok) {
        const retryable = isRetryableStatus(response.status);

        if (retryable && attempt < retry.retries) {
          retryCount += 1;
          const retryAfterMs =
            parseRetryAfterMs(response.headers.get("retry-after")) ??
            getBackoffDelayMs(attempt + 1, retry);
          await wait(retryAfterMs);
          continue;
        }

        throw new OfficialApiError({
          code: `HTTP_${response.status}`,
          source: request.source,
          status: response.status,
          retryable,
          message: `Official API request failed with status ${response.status}.`,
        });
      }

      const data = (await withTimeout(
        response.json() as Promise<T>,
        request.timeoutMs ?? DEFAULT_TIMEOUT_MS,
      )) as T;
      const empty = request.emptyWhen?.(data) ?? false;

      return {
        ok: true,
        source: request.source,
        status: response.status,
        empty,
        data: empty ? null : data,
        meta: {
          sanitizedUrl,
          importRunId: request.importRunId,
          rawPayloadHash: request.rawPayloadHash,
          retryCount,
        },
      };
    } catch (error) {
      const isLastAttempt = attempt >= retry.retries;
      const retryable =
        error instanceof OfficialApiError
          ? error.retryable
          : error instanceof DOMException && error.name === "AbortError";

      if (retryable && !isLastAttempt) {
        retryCount += 1;
        await wait(getBackoffDelayMs(attempt + 1, retry));
        continue;
      }

      return toFailure({
        request,
        sanitizedUrl,
        status: error instanceof OfficialApiError ? error.status : undefined,
        code: error instanceof OfficialApiError ? error.code : "REQUEST_FAILED",
        message: toSafeErrorMessage(error),
        retryable,
        retryCount,
      });
    }
  }

  return toFailure({
    request,
    sanitizedUrl,
    code: "REQUEST_FAILED",
    message: "Official API request failed.",
    retryable: false,
    retryCount,
  });
}
