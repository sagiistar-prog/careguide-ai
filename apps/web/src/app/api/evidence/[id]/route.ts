import { NextResponse } from "next/server";
import { safeErrorResponse, safeRouteError } from "../../../../lib/api/errors";
import { safeEvidenceItems } from "../../../../lib/api/safe-response";
import { closeServerDb, createServerDb } from "../../../../lib/db/postgres";
import type { EvidencePackage } from "../../../../lib/retrieval/types";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

type ChunkRow = {
  chunk_id: string;
  source_id: string;
  document_title: string;
  source_organization: string;
  source_type: string;
  section_name: string;
  book_title: string | null;
  page_start: number | null;
  page_end: number | null;
  location: string | null;
  published_at: string | null;
  source_updated_at: string | null;
  source_excerpt: string;
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function trimExcerpt(value: string) {
  const compact = value.replace(/\s+/g, " ").trim();
  return compact.length > 520 ? `${compact.slice(0, 520).trim()}...` : compact;
}

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;

  if (!UUID_PATTERN.test(id)) {
    return safeErrorResponse({
      status: 400,
      code: "BAD_REQUEST",
      message: "Evidence id must be a UUID.",
    });
  }

  const db = createServerDb();

  try {
    const packageRows = await db<{ package_json: EvidencePackage }[]>`
      select package_json
      from public.evidence_packages
      where id = ${id}
      limit 1
    `;

    if (packageRows[0]?.package_json) {
      return NextResponse.json({
        evidence_package_id: id,
        evidence: safeEvidenceItems(packageRows[0].package_json),
      });
    }

    const chunkRows = await db<ChunkRow[]>`
      select
        sc.id as chunk_id,
        sc.source_id,
        sd.document_title,
        sd.source_institution as source_organization,
        sd.source_type,
        sc.section_title as section_name,
        sc.book_title,
        sc.page_start,
        sc.page_end,
        sc.location,
        sc.published_at,
        sc.updated_at as source_updated_at,
        sc.original_text as source_excerpt
      from public.source_chunks sc
      join public.source_documents sd on sd.id = sc.source_document_id
      where sc.id = ${id}
      limit 1
    `;
    const chunk = chunkRows[0];

    if (!chunk) {
      return safeErrorResponse({
        status: 404,
        code: "NOT_FOUND",
        message: "Evidence was not found.",
      });
    }

    return NextResponse.json({
      source_id: chunk.source_id,
      chunk_id: chunk.chunk_id,
      document_title: chunk.document_title,
      source_organization: chunk.source_organization,
      source_type: chunk.source_type,
      section_name: chunk.section_name,
      book_title: chunk.book_title,
      page_start: chunk.page_start,
      page_end: chunk.page_end,
      location: chunk.location,
      published_at: chunk.published_at,
      source_updated_at: chunk.source_updated_at,
      source_excerpt: trimExcerpt(chunk.source_excerpt),
      score: null,
      why_selected: ["direct_citation_lookup"],
    });
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
