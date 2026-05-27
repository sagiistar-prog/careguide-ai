import type { Sql } from "postgres";

export type RetrievalDb = Sql;

export type EntityMatch = {
  id: string;
  entity_type: string;
  canonical_name: string;
  display_name: string;
  matched_value: string;
  match_source: "entity" | "mapping" | "rule";
};

export type NormalizedQuery = {
  original_query: string;
  normalized_query: string;
  language: "zh" | "en" | "mixed" | "unknown";
  user_context: {
    age: number | null;
    sex: "male" | "female" | "unknown";
  };
  medication_preference: "tcm" | "western" | "any";
  question_type:
    | "find_medicine"
    | "dosage"
    | "contraindications"
    | "adverse_reactions"
    | "warnings"
    | "prescription"
    | "disease_knowledge"
    | "general";
  detected_symptoms: string[];
  detected_drugs: EntityMatch[];
  detected_conditions: EntityMatch[];
  detected_population: string[];
  detected_scenario: EntityMatch[];
  risk_terms: string[];
  section_intents: string[];
  search_terms: string[];
  book_intent: boolean;
  expanded_terms: string[];
  book_query_terms: {
    common_disease_terms: string[];
    tcm_pattern_terms: string[];
    book_intent_terms: string[];
    prescription_structure_terms: string[];
    medicine_form_terms: string[];
  };
};

export type ChunkEvidenceBase = {
  chunk_id: string;
  source_document_id: string;
  source_id: string;
  source_type: string;
  section_name: string;
  section_key: string;
  document_title: string;
  source_organization: string;
  published_at: string | null;
  source_updated_at: string | null;
  chunk_index: number;
  scenario_tags: string[];
  medicine_names: string[];
  ingredient_names: string[];
  applicable_populations: string[];
  book_title: string | null;
  page_start: number | null;
  page_end: number | null;
  location: string | null;
};

export type KeywordSearchResult = ChunkEvidenceBase & {
  keyword_rank: number;
  keyword_score: number;
  matched_terms: string[];
  content_signals?: string[];
};

export type VectorSearchResult = ChunkEvidenceBase & {
  vector_rank: number;
  vector_score: number;
  distance: number;
  embedding_model: string;
  dimension: number;
};

export type HybridCandidate = ChunkEvidenceBase & {
  keyword_rank?: number;
  keyword_score?: number;
  vector_rank?: number;
  vector_score?: number;
  distance?: number;
  embedding_model?: string;
  dimension?: number;
  matched_terms: string[];
  content_signals?: string[];
  rrf_score: number;
  rerank_score: number;
  why_selected: string[];
};

export type ExcludedEvidence = {
  chunk_id: string;
  source_id?: string;
  reason: string;
};

export type SelectedEvidence = ChunkEvidenceBase & {
  source_excerpt: string;
  score: number;
  rrf_score: number;
  keyword_rank?: number;
  vector_rank?: number;
  why_selected: string[];
};

export type EvidencePackage = {
  evidence_package_id: string;
  query: string;
  normalized_query: NormalizedQuery;
  detected_entities: {
    drugs: EntityMatch[];
    conditions: EntityMatch[];
    scenarios: EntityMatch[];
    population: string[];
  };
  retrieval_mode: "hybrid" | "keyword_only";
  keyword_available: boolean;
  vector_available: boolean;
  keyword_result_count: number;
  vector_result_count: number;
  vector_error?: {
    error_type: string;
    message: string;
  };
  total_candidates: number;
  selected_evidence: SelectedEvidence[];
  excluded_evidence: ExcludedEvidence[];
  safety_flags: string[];
  insufficient_evidence: boolean;
  created_at: string;
};

export type HybridSearchOptions = {
  keywordTopK?: number;
  vectorTopK?: number;
  selectedTopK?: number;
};
