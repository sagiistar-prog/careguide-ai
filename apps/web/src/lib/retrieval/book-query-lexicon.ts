export const COMMON_DISEASE_TERMS = [
  "腹痛",
  "肚子痛",
  "胃痛",
  "胃脘痛",
  "腹泻",
  "便秘",
  "消化不良",
  "中暑",
  "发热",
  "发烧",
  "感冒",
  "风寒感冒",
  "风热感冒",
  "咳嗽",
  "咽痛",
  "鼻炎",
  "过敏",
  "皮肤瘙痒",
  "头痛",
  "头疼",
  "疼痛",
  "痛经",
  "经痛",
  "眩晕",
  "失眠",
  "心悸",
  "高血压",
  "糖尿病",
  "高脂血症",
] as const;

export const TCM_PATTERN_TERMS = [
  "气滞血瘀",
  "肝胆湿热",
  "上热下寒",
  "饮食积滞",
  "风寒束表",
  "风热犯肺",
  "暑湿",
  "湿热",
  "脾胃虚寒",
  "肝郁气滞",
  "痰湿",
  "血瘀",
  "阴虚",
  "阳虚",
  "气虚",
] as const;

export const BOOK_INTENT_TERMS = [
  "书中",
  "书里",
  "通用处方",
  "常用处方",
  "处方参考",
  "用药方案",
  "家庭用药",
  "常见病",
  "中成药",
  "中药",
  "门诊处方",
  "用药指南",
  "适用于",
] as const;

export const PRESCRIPTION_STRUCTURE_TERMS = [
  "处方",
  "用法",
  "用量",
  "口服",
  "每日",
  "每次",
  "疗程",
  "适用于",
  "适应症",
  "主治",
  "注意",
  "禁忌",
  "不宜",
  "慎用",
  "必要时",
  "联合",
  "或",
  "选择",
] as const;

export const MEDICINE_FORM_TERMS = [
  "片",
  "胶囊",
  "颗粒",
  "丸",
  "散",
  "汤",
  "口服液",
  "注射液",
  "煎服",
  "冲服",
  "外用",
] as const;

export const KNOWN_MEDICINE_CANDIDATE_TERMS = [
  "感冒清热颗粒",
  "风寒感冒颗粒",
  "小青龙合剂",
  "通宣理肺丸",
  "止嗽宁嗽胶囊",
  "杏苏止咳糖浆",
  "三拗片",
  "藿香正气水",
  "藿香正气胶囊",
  "银翘解毒片",
  "连花清瘟胶囊",
  "板蓝根颗粒",
  "双黄连口服液",
  "复方鲜竹沥液",
  "清开灵颗粒",
  "小柴胡颗粒",
  "保和丸",
  "大山楂丸",
  "附子理中丸",
  "麻仁丸",
  "布洛芬",
  "对乙酰氨基酚",
  "荆防颗粒",
] as const;

const EXPLICIT_ENGLISH_DRUGS = [
  "acetaminophen",
  "paracetamol",
  "ibuprofen",
  "amlodipine",
  "lisinopril",
  "metformin",
] as const;

const BOOK_QUESTION_PATTERNS = [
  "有哪些处方",
  "怎么用药",
  "用药指南",
  "可以参考哪些",
  "怎么办",
  "怎么处理",
  "怎么调养",
  "怎么改善",
  "吃什么药",
  "吃点什么",
  "用什么药",
  "有哪些药",
  "哪些药",
  "可以吃哪些药",
] as const;

const SYMPTOM_EXPANSIONS = [
  {
    triggers: ["肚子痛", "腹痛", "胃痛", "胃脘痛"],
    terms: [
      "腹痛",
      "胃脘痛",
      "胃痛",
      "气滞血瘀",
      "肝胆湿热",
      "上热下寒",
      "饮食积滞",
      "处方",
      "适用于",
      "用法",
      "用量",
      "注意",
    ],
  },
  {
    triggers: ["中暑", "暑热", "暑湿"],
    terms: [
      "中暑",
      "暑热",
      "暑湿",
      "高温",
      "清暑",
      "处方",
      "适用于",
      "用法",
      "用量",
      "注意",
    ],
  },
  {
    triggers: ["风寒感冒", "风寒", "感冒"],
    terms: [
      "风寒感冒",
      "风寒束表",
      "感冒",
      "恶寒",
      "发热",
      "咳嗽",
      "中成药",
      "处方",
      "用法",
      "注意",
    ],
  },
  {
    triggers: ["发热", "发烧"],
    terms: ["发热", "发烧", "退热", "布洛芬", "对乙酰氨基酚", "用量", "注意"],
  },
  {
    triggers: ["咳嗽", "咽痛"],
    terms: ["咳嗽", "咽痛", "风寒", "风热", "痰湿", "中成药", "处方", "用法", "注意"],
  },
  {
    triggers: ["腹泻", "泄泻"],
    terms: ["腹泻", "泄泻", "湿热", "脾胃虚寒", "饮食积滞", "处方", "用法", "注意"],
  },
  {
    triggers: ["失眠"],
    terms: ["失眠", "心悸", "阴虚", "血瘀", "气虚", "中成药", "处方", "用法", "注意"],
  },
  {
    triggers: ["头痛", "眩晕"],
    terms: [
      "头痛",
      "头疼",
      "疼痛",
      "止痛",
      "眩晕",
      "风寒",
      "风热",
      "肝阳",
      "血瘀",
      "中成药",
      "处方",
      "用法",
      "注意",
      "ibuprofen",
      "acetaminophen",
      "paracetamol",
      "pain",
      "headache",
    ],
  },
  {
    triggers: ["痛经", "经痛"],
    terms: [
      "痛经",
      "经痛",
      "疼痛",
      "止痛",
      "血瘀",
      "寒凝",
      "气滞",
      "中成药",
      "处方",
      "用法",
      "用量",
      "注意",
      "ibuprofen",
      "pain",
    ],
  },
] as const;

const OFFICIAL_REFERENCE_EXPANSIONS = [
  {
    triggers: ["感冒", "发热", "发烧", "退热", "儿童发烧", "儿童退热"],
    terms: [
      "fever",
      "common cold",
      "pediatric",
      "acetaminophen",
      "paracetamol",
      "ibuprofen",
    ],
  },
  {
    triggers: ["头痛", "头疼", "疼痛", "止痛", "痛经", "经痛"],
    terms: [
      "pain",
      "headache",
      "acetaminophen",
      "paracetamol",
      "ibuprofen",
      "analgesic",
    ],
  },
  {
    triggers: ["高血压", "血压"],
    terms: ["hypertension", "high blood pressure", "amlodipine", "lisinopril"],
  },
  {
    triggers: ["糖尿病", "血糖"],
    terms: ["diabetes", "type 2 diabetes", "metformin"],
  },
] as const;

export type BookQueryLexiconMatch = {
  common_disease_terms: string[];
  tcm_pattern_terms: string[];
  book_intent_terms: string[];
  prescription_structure_terms: string[];
  medicine_form_terms: string[];
};

export type BookQueryLexiconResult = {
  book_intent: boolean;
  matched_terms: BookQueryLexiconMatch;
  expanded_terms: string[];
};

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

export function findLexiconMatches(
  query: string,
  terms: readonly string[],
): string[] {
  return terms.filter((term) => query.includes(term));
}

function hasExplicitEnglishDrugName(query: string) {
  return EXPLICIT_ENGLISH_DRUGS.some((drug) =>
    new RegExp(`\\b${drug}\\b`, "i").test(query),
  );
}

function hasBookQuestionPattern(query: string) {
  return BOOK_QUESTION_PATTERNS.some((pattern) => query.includes(pattern));
}

function expansionTermsFor(query: string) {
  const symptomTerms = SYMPTOM_EXPANSIONS.flatMap((group) =>
    group.triggers.some((trigger) => query.includes(trigger)) ? group.terms : [],
  );
  const officialTerms = OFFICIAL_REFERENCE_EXPANSIONS.flatMap((group) =>
    group.triggers.some((trigger) => query.includes(trigger)) ? group.terms : [],
  );

  return unique([...symptomTerms, ...officialTerms]);
}

export function analyzeBookQuery(query: string): BookQueryLexiconResult {
  const matchedTerms: BookQueryLexiconMatch = {
    common_disease_terms: findLexiconMatches(query, COMMON_DISEASE_TERMS),
    tcm_pattern_terms: findLexiconMatches(query, TCM_PATTERN_TERMS),
    book_intent_terms: findLexiconMatches(query, BOOK_INTENT_TERMS),
    prescription_structure_terms: findLexiconMatches(
      query,
      PRESCRIPTION_STRUCTURE_TERMS,
    ),
    medicine_form_terms: findLexiconMatches(query, MEDICINE_FORM_TERMS),
  };
  const commonDiseaseQuestion =
    matchedTerms.common_disease_terms.length > 0 && !hasExplicitEnglishDrugName(query);
  const bookIntent =
    matchedTerms.book_intent_terms.length > 0 ||
    matchedTerms.tcm_pattern_terms.length > 0 ||
    commonDiseaseQuestion ||
    hasBookQuestionPattern(query);
  const structureTerms = bookIntent
    ? ["处方", "适用于", "适应症", "用法", "用量", "注意", "禁忌", "慎用"]
    : [];

  return {
    book_intent: bookIntent,
    matched_terms: matchedTerms,
    expanded_terms: unique([
      ...matchedTerms.common_disease_terms,
      ...matchedTerms.tcm_pattern_terms,
      ...matchedTerms.book_intent_terms,
      ...matchedTerms.prescription_structure_terms,
      ...matchedTerms.medicine_form_terms,
      ...expansionTermsFor(query),
      ...structureTerms,
    ]),
  };
}

export function hasBookReferenceIntent(query: string) {
  return analyzeBookQuery(query).book_intent;
}
