import { NextResponse } from "next/server";

export type SafeErrorCode =
  | "BAD_REQUEST"
  | "METHOD_NOT_ALLOWED"
  | "NOT_FOUND"
  | "INTERNAL_ERROR";

export function safeErrorResponse(input: {
  status: number;
  code: SafeErrorCode;
  message: string;
  requestId?: string;
}) {
  return NextResponse.json(
    {
      error: {
        code: input.code,
        message: input.message,
        request_id: input.requestId,
      },
    },
    { status: input.status },
  );
}

export function safeRouteError(error: unknown) {
  if (error instanceof Error && error.message.includes("Missing required")) {
    return "Server configuration is incomplete. Secret values were not printed.";
  }

  return "The request could not be completed safely.";
}
