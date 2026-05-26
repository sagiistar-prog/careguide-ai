import type { RetrievalDb } from "../retrieval/types";
import type {
  AnswerSentence,
  CitationValidationResult,
  StructuredAnswer,
} from "./types";

function textArray(values: string[]) {
  return values;
}

function allSentences(answer: StructuredAnswer) {
  const rows: AnswerSentence[] = [
    ...answer.plain_language_summary,
    ...answer.safety_notices,
    ...answer.questions_for_doctor_or_pharmacist,
    ...answer.limitations,
    ...answer.evidence_cards.map((card, index) => ({
      sentence_id: `card_${index + 1}`,
      text: card.plain_language_text,
      claim_type:
        card.card_type === "adverse_reactions"
          ? ("adverse_reaction" as const)
          : card.card_type === "warnings"
            ? ("warning" as const)
            : card.card_type === "contraindications"
              ? ("contraindication" as const)
              : card.card_type === "dosage"
                ? ("dose" as const)
                : card.card_type === "children"
                  ? ("child" as const)
                  : card.card_type === "elderly"
                    ? ("older_adult" as const)
                    : card.card_type === "pregnancy"
                      ? ("pregnancy" as const)
                      : card.card_type === "insufficient_evidence"
                        ? ("insufficient_evidence" as const)
                        : ("general" as const),
      citation_ids: card.citation_ids,
      source_ids: card.source_ids,
      chunk_ids: card.chunk_ids,
    })),
  ];

  return rows;
}

export async function persistAnswerAudit(input: {
  db: RetrievalDb;
  evidencePackageId: string;
  answer: StructuredAnswer;
  validation: CitationValidationResult;
}) {
  await input.db`
    delete from public.answer_sentences
    where evidence_package_id = ${input.evidencePackageId}
  `;

  const sentenceIds: string[] = [];
  const sentences = allSentences(input.answer);

  for (const [index, sentence] of sentences.entries()) {
    const hasValidationError =
      sentence.text === "当前知识库无法确认" &&
      sentence.claim_type === "insufficient_evidence";
    const rows = await input.db<{ id: string }[]>`
      insert into public.answer_sentences (
        evidence_package_id,
        sentence_index,
        sentence_text,
        claim_type,
        citation_ids,
        source_ids,
        valid,
        validation_error
      ) values (
        ${input.evidencePackageId},
        ${index},
        ${sentence.text},
        ${sentence.claim_type},
        ${textArray(sentence.citation_ids)},
        ${textArray(sentence.source_ids)},
        ${!hasValidationError},
        ${hasValidationError ? "claim_replaced_with_insufficient_evidence" : null}
      )
      returning id
    `;

    if (rows[0]?.id) {
      sentenceIds.push(rows[0].id);
    }
  }

  await input.db`
    insert into public.citation_audits (
      evidence_package_id,
      status,
      missing_fields,
      audit_json
    ) values (
      ${input.evidencePackageId},
      ${input.validation.valid ? "passed" : "warning"},
      ${input.validation.valid ? [] : ["citation_coverage_below_100"]},
      ${input.db.json({
        answer_id: input.answer.answer_id,
        answer_status: input.answer.answer_status,
        sentence_count: sentences.length,
        answer_sentence_ids: sentenceIds,
        citation_coverage: input.validation.citation_coverage,
        rejected_claim_count: input.answer.rejected_claims.length,
      } as never)}
    )
  `;
}
