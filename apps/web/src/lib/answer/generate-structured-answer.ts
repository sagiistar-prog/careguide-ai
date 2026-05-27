import { randomUUID } from "node:crypto";
import type { EvidencePackage, SelectedEvidence } from "../retrieval/types";
import { validateCitations } from "./citation-validator";
import { generateGeminiJson } from "./gemini-client";
import { buildAnswerPrompt } from "./prompt";
import { applySafetyGuard } from "./safety-guard";
import type {
  AnswerSentence,
  EvidenceCard,
  GenerateAnswerInput,
  MedicationFields,
  StructuredAnswer,
} from "./types";

function fallbackCitation(item: SelectedEvidence) {
  return {
    citation_id: item.chunk_id,
    source_id: item.source_id,
    chunk_id: item.chunk_id,
    source_document_id: item.source_document_id,
    document_title: item.document_title,
    source_organization: item.source_organization,
    published_at: item.published_at,
    source_updated_at: item.source_updated_at,
    section_name: item.section_name,
  };
}

function sentence(input: {
  id: string;
  text: string;
  claimType: AnswerSentence["claim_type"];
  evidence?: SelectedEvidence;
}): AnswerSentence {
  return {
    sentence_id: input.id,
    text: input.text,
    claim_type: input.claimType,
    citation_ids: input.evidence ? [input.evidence.chunk_id] : [],
    source_ids: input.evidence ? [input.evidence.source_id] : [],
    chunk_ids: input.evidence ? [input.evidence.chunk_id] : [],
  };
}

function cardType(sectionName: string): EvidenceCard["card_type"] {
  const section = sectionName.toLowerCase();

  if (section.includes("contraindication")) {
    return "contraindications";
  }

  if (section.includes("adverse")) {
    return "adverse_reactions";
  }

  if (section.includes("dosage") || section.includes("dose")) {
    return "dosage";
  }

  if (section.includes("pediatric") || section.includes("children")) {
    return "children";
  }

  if (section.includes("pregnancy")) {
    return "pregnancy";
  }

  if (section.includes("warning")) {
    return "warnings";
  }

  return "patient_education";
}

function fallbackAnswer(input: {
  evidencePackage: EvidencePackage;
  reason?: string;
}): StructuredAnswer {
  const firstEvidence = input.evidencePackage.selected_evidence[0];

  if (input.evidencePackage.insufficient_evidence || !firstEvidence) {
    return {
      answer_id: randomUUID(),
      evidence_package_id: input.evidencePackage.evidence_package_id,
      query: input.evidencePackage.query,
      answer_status: "insufficient_evidence",
      plain_language_summary: [
        sentence({
          id: "s1",
          text: "当前知识库无法确认",
          claimType: "insufficient_evidence",
        }),
      ],
      evidence_cards: [
        {
          card_type: "insufficient_evidence",
          title: "当前知识库无法确认",
          plain_language_text: "当前本地证据包没有足够来源片段支持结论。",
          original_excerpt: "",
          citation_ids: [],
          source_ids: [],
          chunk_ids: [],
          confidence: "low",
          applicability: "无足够本地证据。",
          not_applicable_when: "不能用模型记忆或外部网页补足。",
        },
      ],
      safety_notices: [],
      questions_for_doctor_or_pharmacist: [],
      limitations: [
        sentence({
          id: "l1",
          text: input.reason ?? "当前知识库无法确认",
          claimType: "insufficient_evidence",
        }),
      ],
      citations: [],
      rejected_claims: input.reason
        ? [{ text: input.reason, reason: "safe_generation_fallback" }]
        : [],
    };
  }

  return {
    answer_id: randomUUID(),
    evidence_package_id: input.evidencePackage.evidence_package_id,
    query: input.evidencePackage.query,
    answer_status: "answered_with_evidence",
    plain_language_summary: [
      sentence({
        id: "s1",
        text: `本地证据包中，${firstEvidence.document_title} 的 ${firstEvidence.section_name} 章节包含与问题相关的资料。`,
        claimType: "general",
        evidence: firstEvidence,
      }),
    ],
    evidence_cards: input.evidencePackage.selected_evidence
      .slice(0, 4)
      .map((item) => ({
        card_type: cardType(item.section_name),
        title: `${item.document_title} - ${item.section_name}`,
        plain_language_text: `该卡片整理自 ${item.source_organization} 的 ${item.section_name} 章节；这里只呈现资料如何描述，不提供诊断或用药建议。`,
        original_excerpt: item.source_excerpt,
        citation_ids: [item.chunk_id],
        source_ids: [item.source_id],
        chunk_ids: [item.chunk_id],
        confidence: "medium" as const,
        applicability: "仅适用于该来源片段描述的药品、章节和人群。",
        not_applicable_when: "药品、人群、症状或风险情境不一致时，需要医生或药师确认。",
      })),
    safety_notices: [],
    questions_for_doctor_or_pharmacist: [
      sentence({
        id: "q1",
        text: "这些资料中的警示是否适用于我的年龄、既往病史和正在使用的药物？",
        claimType: "professional_confirmation",
      }),
    ],
    limitations: input.reason
      ? [
          sentence({
            id: "l1",
            text: input.reason,
            claimType: "insufficient_evidence",
          }),
        ]
      : [],
    citations: input.evidencePackage.selected_evidence.map(fallbackCitation),
    rejected_claims: input.reason
      ? [{ text: input.reason, reason: "safe_generation_fallback" }]
      : [],
  };
}

function asStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function normalizeSentence(value: unknown, index: number): AnswerSentence {
  const record =
    typeof value === "object" && value !== null
      ? (value as Record<string, unknown>)
      : {};

  return {
    sentence_id:
      typeof record.sentence_id === "string" ? record.sentence_id : `s${index + 1}`,
    text:
      typeof record.text === "string" && record.text.trim()
        ? record.text
        : "当前知识库无法确认",
    claim_type: normalizeClaimType(record.claim_type),
    citation_ids: asStringArray(record.citation_ids),
    source_ids: asStringArray(record.source_ids),
    chunk_ids: asStringArray(record.chunk_ids),
  };
}

function normalizeClaimType(value: unknown): AnswerSentence["claim_type"] {
  if (typeof value !== "string") {
    return "general";
  }

  const normalized = value.toLowerCase();

  if (normalized === "warnings") {
    return "warning";
  }

  if (normalized === "contraindications") {
    return "contraindication";
  }

  if (normalized === "adverse_reactions" || normalized === "side_effects") {
    return "adverse_reaction";
  }

  if (normalized === "dosage") {
    return "dose";
  }

  if (normalized === "children") {
    return "child";
  }

  if (normalized === "elderly") {
    return "older_adult";
  }

  if (
    [
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
      "insufficient_evidence",
      "professional_confirmation",
    ].includes(normalized)
  ) {
    return normalized as AnswerSentence["claim_type"];
  }

  return "general";
}

function normalizeMedicationFields(value: unknown): MedicationFields | undefined {
  if (typeof value !== "object" || value === null) {
    return undefined;
  }

  const record = value as Record<string, unknown>;
  const stringField = (key: keyof MedicationFields) =>
    typeof record[key] === "string" ? String(record[key]).trim() : undefined;
  const category =
    record.medicine_category === "western" ||
    record.medicine_category === "tcm" ||
    record.medicine_category === "knowledge"
      ? record.medicine_category
      : undefined;

  return {
    medicine_name: stringField("medicine_name"),
    medicine_category: category,
    indication: stringField("indication"),
    dosage: stringField("dosage"),
    decoction: stringField("decoction"),
    contraindications: stringField("contraindications"),
    cautions: stringField("cautions"),
    adverse_reactions: stringField("adverse_reactions"),
  };
}

function normalizeCard(value: unknown): EvidenceCard {
  const record =
    typeof value === "object" && value !== null
      ? (value as Record<string, unknown>)
      : {};

  return {
    card_type:
      typeof record.card_type === "string"
        ? (record.card_type as EvidenceCard["card_type"])
        : "patient_education",
    title: typeof record.title === "string" ? record.title : "Evidence",
    plain_language_text:
      typeof record.plain_language_text === "string"
        ? record.plain_language_text
        : "当前知识库无法确认",
    original_excerpt:
      typeof record.original_excerpt === "string" ? record.original_excerpt : "",
    citation_ids: asStringArray(record.citation_ids),
    source_ids: asStringArray(record.source_ids),
    chunk_ids: asStringArray(record.chunk_ids),
    confidence:
      record.confidence === "high" ||
      record.confidence === "medium" ||
      record.confidence === "low"
        ? record.confidence
        : "low",
    applicability:
      typeof record.applicability === "string" ? record.applicability : "",
    not_applicable_when:
      typeof record.not_applicable_when === "string"
        ? record.not_applicable_when
        : "",
    medication_fields: normalizeMedicationFields(record.medication_fields),
  };
}

function normalizeAnswerStatus(value: unknown): StructuredAnswer["answer_status"] {
  if (
    value === "answered_with_evidence" ||
    value === "insufficient_evidence" ||
    value === "needs_professional_confirmation" ||
    value === "blocked_high_risk"
  ) {
    return value;
  }

  return "answered_with_evidence";
}

function normalizeGeminiAnswer(input: {
  jsonText: string;
  evidencePackage: EvidencePackage;
}) {
  const parsed = JSON.parse(input.jsonText) as Record<string, unknown>;

  return {
    answer_id: randomUUID(),
    evidence_package_id: input.evidencePackage.evidence_package_id,
    query: input.evidencePackage.query,
    answer_status: normalizeAnswerStatus(parsed.answer_status),
    plain_language_summary: Array.isArray(parsed.plain_language_summary)
      ? parsed.plain_language_summary.map(normalizeSentence)
      : [],
    evidence_cards: Array.isArray(parsed.evidence_cards)
      ? parsed.evidence_cards.map(normalizeCard)
      : [],
    safety_notices: Array.isArray(parsed.safety_notices)
      ? parsed.safety_notices.map((item, index) => ({
          ...normalizeSentence(item, index),
          claim_type: "professional_confirmation" as const,
        }))
      : [],
    questions_for_doctor_or_pharmacist: Array.isArray(
      parsed.questions_for_doctor_or_pharmacist,
    )
      ? parsed.questions_for_doctor_or_pharmacist.map((item, index) => ({
          ...normalizeSentence(item, index),
          claim_type: "professional_confirmation" as const,
        }))
      : [],
    limitations: Array.isArray(parsed.limitations)
      ? parsed.limitations.map((item, index) => ({
          ...normalizeSentence(item, index),
          claim_type: "insufficient_evidence" as const,
        }))
      : [],
    citations: input.evidencePackage.selected_evidence.map(fallbackCitation),
    rejected_claims: Array.isArray(parsed.rejected_claims)
      ? parsed.rejected_claims.flatMap((item) => {
          if (typeof item !== "object" || item === null) {
            return [];
          }

          const record = item as Record<string, unknown>;
          return [
            {
              text: typeof record.text === "string" ? record.text : "",
              reason: typeof record.reason === "string" ? record.reason : "rejected",
            },
          ];
        })
      : [],
  } satisfies StructuredAnswer;
}

export async function generateStructuredAnswer(input: GenerateAnswerInput) {
  let answer: StructuredAnswer;

  if (input.evidencePackage.insufficient_evidence) {
    answer = fallbackAnswer({
      evidencePackage: input.evidencePackage,
    });
  } else {
    try {
      const jsonText =
        input.geminiJsonOverride ??
        (await generateGeminiJson({
          apiKey: input.geminiApiKey,
          model: input.geminiModel,
          prompt: buildAnswerPrompt(input.evidencePackage),
        }));
      answer = normalizeGeminiAnswer({
        jsonText,
        evidencePackage: input.evidencePackage,
      });
    } catch (error) {
      answer = fallbackAnswer({
        evidencePackage: input.evidencePackage,
        reason:
          error instanceof Error
            ? `结构化解释生成失败：${error.name}`
            : "结构化解释生成失败。",
      });
    }
  }

  const guarded = applySafetyGuard({
    answer,
    query: input.evidencePackage.query,
  }).answer;
  const validation = validateCitations({
    answer: guarded,
    evidencePackage: input.evidencePackage,
  });

  return {
    answer: validation.sanitized_answer,
    validation,
  };
}
