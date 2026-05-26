import { NextResponse } from "next/server";
import { safeErrorResponse, safeRouteError } from "../../../../lib/api/errors";
import { closeServerDb, createServerDb } from "../../../../lib/db/postgres";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    sourceId: string;
  }>;
};

type SourceRow = {
  source_id: string;
  document_title: string;
  source_organization: string;
  source_type: string;
  source_url: string | null;
  published_at: string | null;
  source_updated_at: string | null;
  version: string | null;
  license_note: string | null;
  country_region: string | null;
};

export async function GET(_request: Request, context: RouteContext) {
  const { sourceId } = await context.params;
  const decodedSourceId = decodeURIComponent(sourceId);

  if (!decodedSourceId || decodedSourceId.length > 300) {
    return safeErrorResponse({
      status: 400,
      code: "BAD_REQUEST",
      message: "sourceId is invalid.",
    });
  }

  const db = createServerDb();

  try {
    const rows = await db<SourceRow[]>`
      select
        source_id,
        document_title,
        source_institution as source_organization,
        source_type,
        source_url,
        published_at,
        source_updated_at,
        version,
        license_note,
        country_region
      from public.source_documents
      where source_id = ${decodedSourceId}
      limit 1
    `;
    const source = rows[0];

    if (!source) {
      return safeErrorResponse({
        status: 404,
        code: "NOT_FOUND",
        message: "Source was not found.",
      });
    }

    return NextResponse.json(source);
  } catch (error) {
    return safeErrorResponse({
      status: 500,
      code: "INTERNAL_ERROR",
      message: safeRouteError(error),
    });
  } finally {
    await closeServerDb(db);
  }
}
