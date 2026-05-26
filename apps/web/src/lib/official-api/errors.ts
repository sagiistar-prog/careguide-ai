import type { OfficialApiSource } from "./types";

export class OfficialApiError extends Error {
  readonly code: string;
  readonly source: OfficialApiSource;
  readonly status?: number;
  readonly retryable: boolean;

  constructor(input: {
    code: string;
    source: OfficialApiSource;
    message: string;
    status?: number;
    retryable?: boolean;
  }) {
    super(input.message);
    this.name = "OfficialApiError";
    this.code = input.code;
    this.source = input.source;
    this.status = input.status;
    this.retryable = input.retryable ?? false;
  }
}

export function toSafeErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim() !== "") {
    return error.message;
  }

  return "Official API request failed.";
}
