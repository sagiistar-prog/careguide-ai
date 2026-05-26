import type { ChunkEvidenceBase, ExcludedEvidence } from "./types";

export function citationSafetyFlags(candidate: ChunkEvidenceBase) {
  const flags: string[] = [];

  if (!candidate.source_id) {
    flags.push("missing_source_id");
  }

  if (!candidate.source_document_id) {
    flags.push("missing_source_document_id");
  }

  if (!candidate.source_organization) {
    flags.push("missing_source_organization");
  }

  if (!candidate.document_title) {
    flags.push("missing_document_title");
  }

  if (!candidate.published_at && !candidate.source_updated_at) {
    flags.push("missing_source_date");
  }

  return flags;
}

export function toExcludedEvidence(
  candidate: ChunkEvidenceBase,
  reason: string,
): ExcludedEvidence {
  return {
    chunk_id: candidate.chunk_id,
    source_id: candidate.source_id,
    reason,
  };
}
