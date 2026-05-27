import type { EvidencePackage } from "../retrieval/types";

export type AnswerStatus =
  | "answered_with_evidence"
  | "insufficient_evidence"
  | "needs_professional_confirmation"
  | "blocked_high_risk";

export type ClaimType =
  | "general"
  | "medication_use"
  | "contraindication"
  | "warning"
  | "population"
  | "child"
  | "older_adult"
  | "pregnancy"
  | "lactation"
  | "dose"
  | "side_effect"
  | "interaction"
  | "adverse_reaction"
  | "insufficient_evidence"
  | "professional_confirmation";

export type AnswerSentence = {
  sentence_id: string;
  text: string;
  claim_type: ClaimType;
  citation_ids: string[];
  source_ids: string[];
  chunk_ids: string[];
};

export type EvidenceCardType =
  | "usage"
  | "warnings"
  | "contraindications"
  | "adverse_reactions"
  | "dosage"
  | "children"
  | "elderly"
  | "pregnancy"
  | "recall"
  | "patient_education"
  | "insufficient_evidence";

export type MedicationFields = {
  medicine_name?: string;
  medicine_category?: "western" | "tcm" | "knowledge";
  indication?: string;
  dosage?: string;
  decoction?: string;
  contraindications?: string;
  cautions?: string;
  adverse_reactions?: string;
};

export type EvidenceCard = {
  card_type: EvidenceCardType;
  title: string;
  plain_language_text: string;
  original_excerpt: string;
  citation_ids: string[];
  source_ids: string[];
  chunk_ids: string[];
  confidence: "high" | "medium" | "low";
  applicability: string;
  not_applicable_when: string;
  medication_fields?: MedicationFields;
};

export type CitationRecord = {
  citation_id: string;
  source_id: string;
  chunk_id: string;
  source_document_id: string;
  document_title: string;
  source_organization: string;
  published_at: string | null;
  source_updated_at: string | null;
  section_name: string;
};

export type RejectedClaim = {
  text: string;
  reason: string;
};

export type StructuredAnswer = {
  answer_id: string;
  evidence_package_id: string;
  query: string;
  answer_status: AnswerStatus;
  plain_language_summary: AnswerSentence[];
  evidence_cards: EvidenceCard[];
  safety_notices: AnswerSentence[];
  questions_for_doctor_or_pharmacist: AnswerSentence[];
  limitations: AnswerSentence[];
  citations: CitationRecord[];
  rejected_claims: RejectedClaim[];
};

export type CitationValidationResult = {
  valid: boolean;
  citation_coverage: number;
  total_medical_sentences: number;
  cited_medical_sentences: number;
  rejected_claims: RejectedClaim[];
  sanitized_answer: StructuredAnswer;
};

export type SafetyGuardResult = {
  is_high_risk: boolean;
  matched_terms: string[];
  forced_status?: AnswerStatus;
};

export type GenerateAnswerInput = {
  evidencePackage: EvidencePackage;
  geminiApiKey: string;
  geminiModel: string;
  geminiJsonOverride?: string;
};
