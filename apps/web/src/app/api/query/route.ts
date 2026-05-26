import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { persistAnswerAudit } from "../../../lib/answer/answer-persister";
import { generateStructuredAnswer } from "../../../lib/answer/generate-structured-answer";
import { safeErrorResponse, safeRouteError } from "../../../lib/api/errors";
import { safeAnswerResponse } from "../../../lib/api/safe-response";
import { validateQueryBody } from "../../../lib/api/validation";
import { closeServerDb, createServerDb } from "../../../lib/db/postgres";
import { getServerEnv } from "../../../lib/env";
import { hybridSearch } from "../../../lib/retrieval/hybrid-search";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const requestId = randomUUID();
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return safeErrorResponse({
      status: 400,
      code: "BAD_REQUEST",
      message: "Request body must be valid JSON.",
      requestId,
    });
  }

  const validation = validateQueryBody(body);

  if (!validation.ok) {
    return safeErrorResponse({
      status: 400,
      code: "BAD_REQUEST",
      message: validation.message,
      requestId,
    });
  }

  let db: ReturnType<typeof createServerDb> | undefined;

  try {
    const env = getServerEnv({ requireSupabase: true });
    db = createServerDb();
    const evidencePackage = await hybridSearch({
      db,
      query: validation.data.query,
      vectorConfig: {
        apiKey: env.GEMINI_API_KEY,
        embeddingModel: env.GEMINI_EMBEDDING_MODEL,
        embeddingDimension: env.GEMINI_EMBEDDING_DIMENSION,
      },
    });
    const answerResult = await generateStructuredAnswer({
      evidencePackage,
      geminiApiKey: env.GEMINI_API_KEY,
      geminiModel: env.GEMINI_MODEL,
    });

    await persistAnswerAudit({
      db,
      evidencePackageId: evidencePackage.evidence_package_id,
      answer: answerResult.answer,
      validation: answerResult.validation,
    });

    return NextResponse.json(
      safeAnswerResponse({
        requestId,
        evidencePackage,
        validation: answerResult.validation,
      }),
    );
  } catch (error) {
    return safeErrorResponse({
      status: 500,
      code: "INTERNAL_ERROR",
      message: safeRouteError(error),
      requestId,
    });
  } finally {
    if (db) {
      await closeServerDb(db);
    }
  }
}
