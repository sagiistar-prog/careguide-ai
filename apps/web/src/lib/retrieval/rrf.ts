import type {
  HybridCandidate,
  KeywordSearchResult,
  VectorSearchResult,
} from "./types";

const RRF_K = 60;

function reciprocal(rank: number | undefined) {
  return rank == null ? 0 : 1 / (RRF_K + rank);
}

export function reciprocalRankFusion(input: {
  keywordResults: KeywordSearchResult[];
  vectorResults: VectorSearchResult[];
}): HybridCandidate[] {
  const candidates = new Map<string, HybridCandidate>();

  for (const result of input.keywordResults) {
    candidates.set(result.chunk_id, {
      ...result,
      matched_terms: result.matched_terms,
      rrf_score: reciprocal(result.keyword_rank),
      rerank_score: 0,
      why_selected: ["keyword_match"],
    });
  }

  for (const result of input.vectorResults) {
    const existing = candidates.get(result.chunk_id);

    if (existing) {
      candidates.set(result.chunk_id, {
        ...existing,
        vector_rank: result.vector_rank,
        vector_score: result.vector_score,
        distance: result.distance,
        embedding_model: result.embedding_model,
        dimension: result.dimension,
        rrf_score: existing.rrf_score + reciprocal(result.vector_rank),
        why_selected: [...existing.why_selected, "vector_match"],
      });
      continue;
    }

    candidates.set(result.chunk_id, {
      ...result,
      matched_terms: [],
      rrf_score: reciprocal(result.vector_rank),
      rerank_score: 0,
      why_selected: ["vector_match"],
    });
  }

  return Array.from(candidates.values()).sort((a, b) => b.rrf_score - a.rrf_score);
}
