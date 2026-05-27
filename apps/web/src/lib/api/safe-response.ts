import type { CitationValidationResult } from "../answer/types";
import type { EvidencePackage } from "../retrieval/types";

const MAX_EXCERPT_LENGTH = 520;

function trimExcerpt(value: string) {
  const compact = value.replace(/\s+/g, " ").trim();

  if (compact.length <= MAX_EXCERPT_LENGTH) {
    return compact;
  }

  return `${compact.slice(0, MAX_EXCERPT_LENGTH).trim()}...`;
}

export function safeAnswerResponse(input: {
  requestId: string;
  evidencePackage: EvidencePackage;
  validation: CitationValidationResult;
}) {
  const answer = input.validation.sanitized_answer;
  const evidenceByChunk = new Map(
    input.evidencePackage.selected_evidence.map((item) => [item.chunk_id, item]),
  );

  return {
    request_id: input.requestId,
    answer_status: answer.answer_status,
    query: answer.query,
    detected_entities: input.evidencePackage.detected_entities,
    plain_language_summary: answer.plain_language_summary,
    evidence_cards: answer.evidence_cards.map((card) => ({
      ...card,
      original_excerpt: trimExcerpt(card.original_excerpt),
    })),
    safety_notices: answer.safety_notices,
    questions_for_doctor_or_pharmacist:
      answer.questions_for_doctor_or_pharmacist,
    limitations: answer.limitations,
    citations: answer.citations.map((citation) => {
      const evidence = evidenceByChunk.get(citation.chunk_id);

      return {
        ...citation,
        source_type: evidence?.source_type,
        book_title: evidence?.book_title,
        page_start: evidence?.page_start,
        page_end: evidence?.page_end,
        location: evidence?.location,
      };
    }),
    external_search_notes: answer.external_search_notes
      .filter((note) => note.text.trim().length > 0)
      .slice(0, 3)
      .map((note) => ({
        ...note,
        text:
          note.text.length > 220
            ? `${note.text.slice(0, 220).trim()}...`
            : note.text,
      })),
    rejected_claims_count: answer.rejected_claims.length,
    citation_coverage: Math.round(input.validation.citation_coverage * 100),
    created_at: new Date().toISOString(),
  };
}

export function safeEvidenceItems(evidencePackage: EvidencePackage) {
  return evidencePackage.selected_evidence.map((item) => ({
    source_id: item.source_id,
    chunk_id: item.chunk_id,
    document_title: item.document_title,
    source_organization: item.source_organization,
    source_type: item.source_type,
    section_name: item.section_name,
    book_title: item.book_title,
    page_start: item.page_start,
    page_end: item.page_end,
    location: item.location,
    published_at: item.published_at,
    source_updated_at: item.source_updated_at,
    source_excerpt: trimExcerpt(item.source_excerpt),
    score: item.score,
    why_selected: item.why_selected,
  }));
}
