export type OfficialApiSource =
  | "openfda"
  | "nhs"
  | "dailymed"
  | "rxnav"
  | "medlineplus";

export type OfficialApiMethod = "GET";

export type QueryPrimitive = string | number | boolean;

export type QueryParams = Record<
  string,
  QueryPrimitive | QueryPrimitive[] | null | undefined
>;

export type RateLimitConfig = Readonly<{
  key: string;
  minIntervalMs: number;
  maxRetries?: number;
}>;

export type RetryConfig = Readonly<{
  retries: number;
  initialDelayMs: number;
  maxDelayMs: number;
}>;

export type OfficialApiRequest = Readonly<{
  source: OfficialApiSource;
  baseUrl: string;
  path: string;
  method?: OfficialApiMethod;
  query?: QueryParams;
  headers?: HeadersInit;
  timeoutMs?: number;
  rateLimit?: RateLimitConfig;
  retry?: RetryConfig;
  importRunId?: string;
  rawPayloadHash?: string;
  emptyWhen?: (data: unknown) => boolean;
}>;

export type OfficialApiSuccess<T> = Readonly<{
  ok: true;
  source: OfficialApiSource;
  status: number;
  empty: boolean;
  data: T | null;
  meta: {
    sanitizedUrl: string;
    importRunId?: string;
    rawPayloadHash?: string;
    retryCount: number;
  };
}>;

export type OfficialApiFailure = Readonly<{
  ok: false;
  source: OfficialApiSource;
  status?: number;
  error: {
    code: string;
    message: string;
    retryable: boolean;
  };
  meta: {
    sanitizedUrl?: string;
    importRunId?: string;
    retryCount: number;
  };
}>;

export type OfficialApiResult<T> =
  | OfficialApiSuccess<T>
  | OfficialApiFailure;
