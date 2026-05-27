import type { EvidencePackage } from "../retrieval/types";
import type {
  AnswerSentence,
  CitationRecord,
  CitationValidationResult,
  EvidenceCard,
  RejectedClaim,
  StructuredAnswer,
} from "./types";

const CITATION_REQUIRED_CLAIMS = new Set([
  "general",
  "medication_use",
  "contraindication",
  "warning",
  "population",
  "child",
  "older_adult",
  "pregnancy",
  "lactation",
  "dose",
  "side_effect",
  "interaction",
  "adverse_reaction",
]);

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function isMedicalSentence(sentence: AnswerSentence) {
  return CITATION_REQUIRED_CLAIMS.has(sentence.claim_type);
}

function unsupportedSentence(sentenceId: string): AnswerSentence {
  return {
    sentence_id: sentenceId,
    text: "当前知识库无法确认",
    claim_type: "insufficient_evidence",
    citation_ids: [],
    source_ids: [],
    chunk_ids: [],
  };
}

function citationMap(evidencePackage: EvidencePackage) {
  return new Map(
    evidencePackage.selected_evidence.map((item) => [
      item.chunk_id,
      {
        citation_id: item.chunk_id,
        source_id: item.source_id,
        chunk_id: item.chunk_id,
        source_document_id: item.source_document_id,
        document_title: item.document_title,
        source_organization: item.source_organization,
        published_at: item.published_at,
        source_updated_at: item.source_updated_at,
        section_name: item.section_name,
      } satisfies CitationRecord,
    ]),
  );
}

function validateSentence(input: {
  sentence: AnswerSentence;
  citations: Map<string, CitationRecord>;
  rejected: RejectedClaim[];
}) {
  const sentence = {
    ...input.sentence,
    citation_ids: unique(input.sentence.citation_ids ?? []),
    source_ids: unique(input.sentence.source_ids ?? []),
    chunk_ids: unique(input.sentence.chunk_ids ?? []),
  };

  if (!isMedicalSentence(sentence)) {
    return {
      sentence,
      medical: false,
      cited: true,
    };
  }

  const validCitationIds = sentence.citation_ids.filter((citationId) =>
    input.citations.has(citationId),
  );
  const validChunkIds = sentence.chunk_ids.filter((chunkId) =>
    input.citations.has(chunkId),
  );
  const expectedIds = unique([...validCitationIds, ...validChunkIds]);

  if (expectedIds.length === 0) {
    input.rejected.push({
      text: sentence.text,
      reason: "medical_sentence_missing_valid_citation",
    });

    return {
      sentence: unsupportedSentence(sentence.sentence_id),
      medical: true,
      cited: false,
    };
  }

  const records = expectedIds
    .map((citationId) => input.citations.get(citationId))
    .filter((record): record is CitationRecord => Boolean(record));

  return {
    sentence: {
      ...sentence,
      citation_ids: expectedIds,
      chunk_ids: expectedIds,
      source_ids: unique(records.map((record) => record.source_id)),
    },
    medical: true,
    cited: true,
  };
}

function validateCard(input: {
  card: EvidenceCard;
  citations: Map<string, CitationRecord>;
  rejected: RejectedClaim[];
}) {
  if (input.card.card_type === "insufficient_evidence") {
    return input.card;
  }

  const validIds = unique([
    ...input.card.citation_ids,
    ...input.card.chunk_ids,
  ]).filter((id) => input.citations.has(id));

  if (validIds.length === 0) {
    input.rejected.push({
      text: input.card.plain_language_text,
      reason: "evidence_card_missing_valid_citation",
    });

    return null;
  }

  const records = validIds
    .map((id) => input.citations.get(id))
    .filter((record): record is CitationRecord => Boolean(record));

  return {
    ...input.card,
    citation_ids: validIds,
    chunk_ids: validIds,
    source_ids: unique(records.map((record) => record.source_id)),
  };
}

export function validateCitations(input: {
  answer: StructuredAnswer;
  evidencePackage: EvidencePackage;
}): CitationValidationResult {
  const citations = citationMap(input.evidencePackage);
  const rejected: RejectedClaim[] = [...input.answer.rejected_claims];

  const validateSentences = (sentences: AnswerSentence[]) =>
    sentences.map((sentence) => {
      const result = validateSentence({
        sentence,
        citations,
        rejected,
      });

      return result.sentence;
    });

  const plainLanguageSummary = validateSentences(
    input.answer.plain_language_summary,
  );
  const safetyNotices = validateSentences(input.answer.safety_notices);
  const questionsForDoctorOrPharmacist = validateSentences(
    input.answer.questions_for_doctor_or_pharmacist,
  );
  const limitations = validateSentences(input.answer.limitations);
  const evidenceCards = input.answer.evidence_cards
    .map((card) =>
      validateCard({
        card,
        citations,
        rejected,
      }),
    )
    .filter((card): card is EvidenceCard => Boolean(card));
  const finalSentences = [
    ...plainLanguageSummary,
    ...safetyNotices,
    ...questionsForDoctorOrPharmacist,
    ...limitations,
  ];
  const totalMedical = finalSentences.filter(isMedicalSentence).length;
  const citedMedical = finalSentences.filter(
    (sentence) => isMedicalSentence(sentence) && sentence.citation_ids.length > 0,
  ).length;
  const citationCoverage =
    totalMedical === 0 ? 1 : Number((citedMedical / totalMedical).toFixed(4));
  const answerStatus =
    input.answer.answer_status === "needs_professional_confirmation" ||
    input.answer.answer_status === "blocked_high_risk"
      ? input.answer.answer_status
      : input.evidencePackage.insufficient_evidence || evidenceCards.length === 0
        ? "insufficient_evidence"
        : citationCoverage < 1 &&
            input.answer.answer_status === "answered_with_evidence"
          ? "needs_professional_confirmation"
          : input.answer.answer_status;
  const sanitized: StructuredAnswer = {
    ...input.answer,
    answer_status: answerStatus,
    plain_language_summary: plainLanguageSummary,
    safety_notices: safetyNotices,
    questions_for_doctor_or_pharmacist: questionsForDoctorOrPharmacist,
    limitations,
    evidence_cards: evidenceCards,
    citations: Array.from(citations.values()),
    external_search_notes: input.answer.external_search_notes.slice(0, 3),
    rejected_claims: rejected,
  };

  return {
    valid: citationCoverage === 1,
    citation_coverage: citationCoverage,
    total_medical_sentences: totalMedical,
    cited_medical_sentences: citedMedical,
    rejected_claims: rejected,
    sanitized_answer: sanitized,
  };
}
