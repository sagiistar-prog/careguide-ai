import { buildAndSaveEvidencePackage } from "./evidence-package";
import { keywordSearch } from "./keyword-search";
import { normalizeQuery } from "./query-normalizer";
import { rerankEvidence } from "./rerank";
import { reciprocalRankFusion } from "./rrf";
import type { HybridSearchOptions, RetrievalDb } from "./types";
import { vectorSearch, type VectorSearchConfig } from "./vector-search";

const DEFAULT_OPTIONS = {
  keywordTopK: 20,
  vectorTopK: 20,
  selectedTopK: 8,
};

export async function hybridSearch(input: {
  db: RetrievalDb;
  query: string;
  vectorConfig: VectorSearchConfig;
  options?: HybridSearchOptions;
}) {
  const options = {
    ...DEFAULT_OPTIONS,
    ...input.options,
  };
  const normalizedQuery = await normalizeQuery(input.db, input.query);
  const keywordResults = await keywordSearch({
    db: input.db,
    query: normalizedQuery,
    topK: options.keywordTopK,
  });
  const hasLocalIntent =
    normalizedQuery.detected_drugs.length > 0 ||
    normalizedQuery.detected_conditions.length > 0 ||
    normalizedQuery.detected_scenario.length > 0 ||
    normalizedQuery.detected_population.length > 0 ||
    normalizedQuery.risk_terms.length > 0 ||
    normalizedQuery.book_intent;

  if (keywordResults.length === 0 && !hasLocalIntent) {
    return buildAndSaveEvidencePackage({
      db: input.db,
      query: input.query,
      normalizedQuery,
      selected: [],
      excluded: [],
      keywordAvailable: false,
      vectorAvailable: false,
      keywordResultCount: 0,
      vectorResultCount: 0,
      totalCandidates: 0,
    });
  }

  const vectorOutcome = await vectorSearch({
    db: input.db,
    query: normalizedQuery,
    topK: options.vectorTopK,
    config: input.vectorConfig,
  });
  const vectorResults = vectorOutcome.ok ? vectorOutcome.results : [];
  const candidates = reciprocalRankFusion({
    keywordResults,
    vectorResults,
  });
  const { selected, excluded } = rerankEvidence({
    candidates,
    query: normalizedQuery,
    selectedTopK: options.selectedTopK,
  });

  return buildAndSaveEvidencePackage({
    db: input.db,
    query: input.query,
    normalizedQuery,
    selected,
    excluded,
    keywordAvailable: keywordResults.length > 0,
    vectorAvailable: vectorOutcome.ok,
    keywordResultCount: keywordResults.length,
    vectorResultCount: vectorResults.length,
    vectorError: vectorOutcome.ok ? undefined : vectorOutcome.error,
    totalCandidates: candidates.length,
  });
}
