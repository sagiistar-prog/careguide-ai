import type {
  EvidencePackage,
  ExcludedEvidence,
  HybridCandidate,
  NormalizedQuery,
  RetrievalDb,
  SelectedEvidence,
} from "./types";

type ExcerptRow = {
  chunk_id: string;
  original_text: string;
};

function excerpt(text: string, maxLength = 520) {
  const compact = text.replace(/\s+/g, " ").trim();

  if (compact.length <= maxLength) {
    return compact;
  }

  return `${compact.slice(0, maxLength).trim()}...`;
}

export async function buildAndSaveEvidencePackage(input: {
  db: RetrievalDb;
  query: string;
  normalizedQuery: NormalizedQuery;
  selected: HybridCandidate[];
  excluded: ExcludedEvidence[];
  keywordAvailable: boolean;
  vectorAvailable: boolean;
  keywordResultCount: number;
  vectorResultCount: number;
  vectorError?: EvidencePackage["vector_error"];
  totalCandidates: number;
}) {
  const selectedIds = input.selected.map((candidate) => candidate.chunk_id);
  const excerptRows =
    selectedIds.length === 0
      ? []
      : await input.db<ExcerptRow[]>`
          select id as chunk_id, original_text
          from public.source_chunks
          where id = any(${selectedIds}::uuid[])
        `;
  const excerpts = new Map(
    excerptRows.map((row) => [row.chunk_id, excerpt(row.original_text)]),
  );
  const selectedEvidence: SelectedEvidence[] = input.selected.map((candidate) => ({
    chunk_id: candidate.chunk_id,
    source_document_id: candidate.source_document_id,
    source_id: candidate.source_id,
    source_type: candidate.source_type,
    section_name: candidate.section_name,
    section_key: candidate.section_key,
    document_title: candidate.document_title,
    source_organization: candidate.source_organization,
    published_at: candidate.published_at,
    source_updated_at: candidate.source_updated_at,
    chunk_index: candidate.chunk_index,
    scenario_tags: candidate.scenario_tags,
    medicine_names: candidate.medicine_names,
    ingredient_names: candidate.ingredient_names,
    applicable_populations: candidate.applicable_populations,
    book_title: candidate.book_title,
    page_start: candidate.page_start,
    page_end: candidate.page_end,
    location: candidate.location,
    source_excerpt: excerpts.get(candidate.chunk_id) ?? "",
    score: Number(candidate.rerank_score.toFixed(6)),
    rrf_score: Number(candidate.rrf_score.toFixed(6)),
    keyword_rank: candidate.keyword_rank,
    vector_rank: candidate.vector_rank,
    why_selected: candidate.why_selected,
  }));
  const safetyFlags = Array.from(
    new Set([
      ...(input.vectorError ? ["vector_unavailable"] : []),
      ...(selectedEvidence.length === 0 ? ["insufficient_local_evidence"] : []),
    ]),
  );
  const insufficientEvidence = selectedEvidence.length === 0;
  const packageJson: Omit<EvidencePackage, "evidence_package_id" | "created_at"> = {
    query: input.query,
    normalized_query: input.normalizedQuery,
    detected_entities: {
      drugs: input.normalizedQuery.detected_drugs,
      conditions: input.normalizedQuery.detected_conditions,
      scenarios: input.normalizedQuery.detected_scenario,
      population: input.normalizedQuery.detected_population,
    },
    retrieval_mode: input.vectorAvailable ? "hybrid" : "keyword_only",
    keyword_available: input.keywordAvailable,
    vector_available: input.vectorAvailable,
    keyword_result_count: input.keywordResultCount,
    vector_result_count: input.vectorResultCount,
    vector_error: input.vectorError,
    total_candidates: input.totalCandidates,
    selected_evidence: selectedEvidence,
    excluded_evidence: input.excluded,
    safety_flags: safetyFlags,
    insufficient_evidence: insufficientEvidence,
  };
  const rows = await input.db<{ id: string; created_at: string | Date }[]>`
    insert into public.evidence_packages (
      query_text,
      status,
      retrieved_chunk_ids,
      package_json,
      validation_status
    ) values (
      ${input.query},
      ${insufficientEvidence ? "insufficient_evidence" : "ready_for_llm"},
      ${selectedIds},
      ${input.db.json(packageJson as never)},
      ${insufficientEvidence ? "insufficient_evidence" : "retrieval_validated"}
    )
    returning id, created_at
  `;
  const row = rows[0];

  if (!row) {
    throw new Error("Failed to save evidence package.");
  }

  return {
    evidence_package_id: row.id,
    created_at:
      row.created_at instanceof Date
        ? row.created_at.toISOString()
        : String(row.created_at),
    ...packageJson,
  } satisfies EvidencePackage;
}
