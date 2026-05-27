import type {
  AnswerSentence,
  RejectedClaim,
  StructuredAnswer,
} from "./types";

const HIGH_RISK_TERMS = [
  "儿童过量",
  "孕期",
  "妊娠",
  "哺乳",
  "老人多药共用",
  "肝功能异常",
  "肾功能异常",
  "肝肾功能异常",
  "严重过敏",
  "呼吸困难",
  "胸痛",
  "意识异常",
  "过量服用",
  "严重不良反应",
  "用药相互作用",
  "正在服用多种药",
  "多药共用",
  "shortness of breath",
  "chest pain",
  "overdose",
  "severe allergic",
] as const;

const EMERGENCY_OR_SEVERE_TERMS = [
  "呼吸困难",
  "胸痛",
  "意识异常",
  "过量服用",
  "严重过敏",
  "严重不良反应",
  "儿童过量",
  "shortness of breath",
  "chest pain",
  "overdose",
  "severe allergic",
] as const;

const DIRECT_PERSONAL_ADVICE_PATTERNS = [
  /你(现在|本人|直接|可以直接|可直接|就|应该|必须).{0,24}(吃|服用|使用|注射|外用|加量|减量|停用|换药|合用)/,
  /(按|照).{0,12}(这个|该|上述|以上).{0,12}(剂量|用量|处方|方案).{0,16}(吃|服用|使用|执行|用)/,
  /这个(药|处方|方案).{0,12}(适合你|适用于你|就是给你的)/,
  /(你可以|可以).{0,8}直接.{0,12}(吃|服用|使用|照做|这样用)/,
  /推荐你.{0,16}(吃|服用|使用|加量|减量|停用|换药|合用)/,
  /建议你.{0,16}(吃|服用|使用|加量|减量|停用|换药|合用)/,
  /放心使用/,
  /\byou should\b.{0,48}\b(take|use|start|stop|increase|decrease|combine)\b/i,
  /\byou can\b.{0,48}\b(take|use|start|stop|increase|decrease|combine)\b/i,
] as const;

export function assessHighRisk(query: string) {
  const lowered = query.toLowerCase();
  const matchedTerms = HIGH_RISK_TERMS.filter((term) =>
    lowered.includes(term.toLowerCase()),
  );
  const matchedEmergencyTerms = EMERGENCY_OR_SEVERE_TERMS.filter((term) =>
    lowered.includes(term.toLowerCase()),
  );

  return {
    is_high_risk: matchedTerms.length > 0,
    is_emergency_or_severe: matchedEmergencyTerms.length > 0,
    matched_terms: matchedTerms,
    matched_emergency_terms: matchedEmergencyTerms,
    forced_status:
      matchedEmergencyTerms.length > 0
        ? ("needs_professional_confirmation" as const)
        : undefined,
    safety_mode:
      matchedEmergencyTerms.length > 0
        ? ("urgent_risk_with_evidence" as const)
        : matchedTerms.length > 0
          ? ("show_general_prescription_with_risk_context" as const)
          : ("standard_source_backed_explanation" as const),
  };
}

function isDirectPersonalAdvice(text: string) {
  return DIRECT_PERSONAL_ADVICE_PATTERNS.some((pattern) => pattern.test(text));
}

function fallbackSentence(input: {
  sentenceId: string;
  text: string;
  claimType: AnswerSentence["claim_type"];
  citationIds?: string[];
  sourceIds?: string[];
  chunkIds?: string[];
}): AnswerSentence {
  return {
    sentence_id: input.sentenceId,
    text: input.text,
    claim_type: input.claimType,
    citation_ids: input.citationIds ?? [],
    source_ids: input.sourceIds ?? [],
    chunk_ids: input.chunkIds ?? [],
  };
}

export function applySafetyGuard(input: {
  answer: StructuredAnswer;
  query: string;
}) {
  const assessment = assessHighRisk(input.query);
  const rejectedClaims: RejectedClaim[] = [...input.answer.rejected_claims];
  const removeDirectPersonalAdvice = <
    T extends { text?: string; plain_language_text?: string },
  >(
    items: T[],
  ) =>
    items.filter((item) => {
      const text = item.text ?? item.plain_language_text ?? "";

      if (!isDirectPersonalAdvice(text)) {
        return true;
      }

      rejectedClaims.push({
        text,
        reason: "removed_direct_personalized_medication_instruction",
      });
      return false;
    });

  const guarded: StructuredAnswer = {
    ...input.answer,
    plain_language_summary: removeDirectPersonalAdvice(
      input.answer.plain_language_summary,
    ),
    evidence_cards: removeDirectPersonalAdvice(input.answer.evidence_cards),
    safety_notices: removeDirectPersonalAdvice(input.answer.safety_notices),
    questions_for_doctor_or_pharmacist:
      input.answer.questions_for_doctor_or_pharmacist,
    limitations: input.answer.limitations,
    rejected_claims: rejectedClaims,
  };

  if (assessment.is_emergency_or_severe) {
    guarded.answer_status = "needs_professional_confirmation";
  }

  if (assessment.is_high_risk) {
    guarded.safety_notices = [
      fallbackSentence({
        sentenceId: "safety_high_risk_evidence_1",
        text:
          "我会继续展示本地资料中能追溯到来源的通用处方参考和用药信息；同时，这些内容不能自动等同于你的个人处方。",
        claimType: "professional_confirmation",
      }),
      fallbackSentence({
        sentenceId: "safety_high_risk_evidence_2",
        text:
          "年龄、孕期或哺乳、肝肾功能、过敏史、正在使用的药物、症状严重程度和持续时间，都可能改变资料是否适用于你。",
        claimType: "professional_confirmation",
      }),
      ...guarded.safety_notices,
    ];

    if (
      assessment.is_emergency_or_severe &&
      guarded.questions_for_doctor_or_pharmacist.length === 0
    ) {
      guarded.questions_for_doctor_or_pharmacist = [
        fallbackSentence({
          sentenceId: "ask_professional_1",
          text:
            "症状的严重程度、持续时间或伴随表现，是否提示需要及时就医，而不是先自行用药？",
          claimType: "professional_confirmation",
        }),
        fallbackSentence({
          sentenceId: "ask_professional_2",
          text:
            "书籍或说明书中的这类用药资料，是否适用于我的年龄、基础病、过敏史和正在使用的其他药物？",
          claimType: "professional_confirmation",
        }),
      ];
    }
  }

  return {
    assessment,
    answer: guarded,
  };
}
