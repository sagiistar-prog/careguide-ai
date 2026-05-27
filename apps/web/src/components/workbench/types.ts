export type Scenario = {
  key: string;
  title: string;
  description: string;
  coverage_count: number;
  example_questions: string[];
};

export type KbCoverage = {
  source_documents: number;
  source_chunks: number;
  medical_entities: number;
  entity_mappings: number;
  embedding_coverage: number;
  available_scenarios: Array<{
    key: string;
    coverage_count: number;
  }>;
  last_import_run: {
    status: string;
    finished_at: string | null;
  } | null;
  last_embedding_run: string | null;
};

export type AnswerSentence = {
  sentence_id: string;
  text: string;
  claim_type: string;
  citation_ids: string[];
  source_ids: string[];
  chunk_ids: string[];
};

export type MedicationCardData = {
  card_type: string;
  title: string;
  plain_language_text: string;
  original_excerpt: string;
  citation_ids: string[];
  source_ids: string[];
  chunk_ids: string[];
  confidence: "high" | "medium" | "low";
  applicability: string;
  not_applicable_when: string;
  medication_fields?: {
    medicine_name?: string;
    medicine_category?: "western" | "tcm" | "knowledge";
    indication?: string;
    dosage?: string;
    decoction?: string;
    contraindications?: string;
    cautions?: string;
    adverse_reactions?: string;
    external_search_note?: string;
  };
};

export type Citation = {
  citation_id: string;
  source_id: string;
  chunk_id: string;
  source_document_id: string;
  document_title: string;
  source_organization: string;
  source_type?: string;
  book_title?: string | null;
  page_start?: number | null;
  page_end?: number | null;
  location?: string | null;
  published_at: string | null;
  source_updated_at: string | null;
  section_name: string;
};

export type QueryResponse = {
  request_id: string;
  answer_status:
    | "answered_with_evidence"
    | "insufficient_evidence"
    | "needs_professional_confirmation"
    | "blocked_high_risk";
  query: string;
  detected_entities: {
    drugs: Array<{ canonical_name: string; display_name: string }>;
    scenarios: Array<{ canonical_name: string; display_name: string }>;
    population: string[];
  };
  plain_language_summary: AnswerSentence[];
  evidence_cards: MedicationCardData[];
  safety_notices: AnswerSentence[];
  questions_for_doctor_or_pharmacist: AnswerSentence[];
  limitations: AnswerSentence[];
  citations: Citation[];
  external_search_notes?: Array<{
    note_id: string;
    text: string;
    reason: string;
    search_scope: "google_search_grounding";
    used_for: "terminology_calibration" | "local_gap_fallback";
  }>;
  rejected_claims_count: number;
  citation_coverage: number;
  created_at: string;
};

export type SourceDetail = {
  source_id: string;
  chunk_id?: string;
  document_title: string;
  source_organization: string;
  source_type: string;
  section_name?: string;
  book_title?: string | null;
  page_start?: number | null;
  page_end?: number | null;
  location?: string | null;
  published_at: string | null;
  source_updated_at: string | null;
  source_excerpt?: string;
  score?: number | null;
  why_selected?: string[];
  version?: string | null;
  license_note?: string | null;
  country_region?: string | null;
  source_url?: string | null;
};
