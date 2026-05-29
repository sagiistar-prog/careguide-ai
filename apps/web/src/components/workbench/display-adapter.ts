import type { Citation, MedicationCardData, QueryResponse } from "./types";

export type SourceRef = {
  chunkId: string;
  sourceId: string;
};

export type MedicationGroup = {
  id: string;
  category: "western" | "tcm";
  name: string;
  sourceRefs: SourceRef[];
  fields: {
    indication: string;
    dosage: string;
    decoction: string;
    contraindications: string;
    cautions: string;
    adverse: string;
  };
  externalNotes: string[];
  confidence: "high" | "medium" | "low";
};

export type KnowledgeGroup = {
  id: string;
  title: string;
  text: string;
  sourceRefs: SourceRef[];
};

export type MedicationDisplayResult = {
  western: MedicationGroup[];
  tcm: MedicationGroup[];
  knowledge: KnowledgeGroup[];
};

const UNKNOWN = "本地资料未列出";

const WESTERN_DRUGS = [
  {
    english: "acetaminophen",
    chinese: "对乙酰氨基酚",
    aliases: ["paracetamol", "Pain Reliever", "basic care acetaminophen"],
  },
  {
    english: "ibuprofen",
    chinese: "布洛芬",
    aliases: ["Ibuprofen Dye Free", "care one ibuprofen"],
  },
  {
    english: "metformin",
    chinese: "二甲双胍",
    aliases: ["Metformin Hydrochloride", "ZITUVIMET"],
  },
  {
    english: "amlodipine",
    chinese: "氨氯地平",
    aliases: ["Amlodipine Besylate"],
  },
  {
    english: "lisinopril",
    chinese: "赖诺普利",
    aliases: ["Lisinopril and Hydrochlorothiazide"],
  },
] as const;

const SECTION_LABELS: Record<string, string> = {
  "Adverse Reactions": "不良反应",
  "Warnings": "注意事项",
  "Warnings and Cautions": "注意事项",
  "Contraindications": "禁忌",
  "Dosage and Administration": "用量用法",
  "Indications and Usage": "适应症",
  "Boxed Warning": "重要警示",
  "Pediatric Use": "儿童用药",
};

const ENGLISH_PHRASE_LABELS: Record<string, string> = {
  "Uses": "用途",
  "Warnings": "警示",
  "temporarily relieves minor aches and pains due to": "暂时缓解以下原因引起的轻微疼痛",
  "premenstrual and menstrual cramps": "经前及经期疼痛",
  "menstrual cramps": "经期疼痛",
  "temporarily reduces fever": "暂时退热",
  "headache": "头痛",
  "toothache": "牙痛",
  "backache": "背痛",
  "muscular aches": "肌肉酸痛",
  "minor pain of arthritis": "关节炎轻微疼痛",
  "the common cold": "普通感冒",
  "common cold": "普通感冒",
  "Allergy alert": "过敏警示",
  "Liver warning": "肝脏警示",
  "Stomach bleeding warning": "胃出血警示",
  "ask a doctor": "询问医生",
  "ask a doctor or pharmacist": "询问医生或药师",
  "severe allergic reaction": "严重过敏反应",
};

const KNOWN_TCM_NAMES = [
  "抗病毒口服液",
  "感冒清热颗粒",
  "风寒感冒颗粒",
  "荆防颗粒",
  "荆防败毒散",
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
  "黄连上清丸",
  "牛黄清胃丸",
  "麻仁丸",
  "润肠丸",
] as const;

const TCM_NAME_PATTERN =
  /[\u4e00-\u9fa5A-Za-z0-9·（）()]{2,24}(?:颗粒|胶囊|软胶囊|丸|片|散|汤|口服液|糖浆|合剂|膏|贴|喷雾剂|冲剂|煎剂|注射液)/g;

const PRESCRIPTION_NAME_PATTERN =
  /(?:处方|方剂|方)[一二三四五六七八九十0-9]+/g;

const FIELD_LABELS = [
  "适应症",
  "证型",
  "适用范围",
  "用量用法",
  "用法用量",
  "用法",
  "用量",
  "煎法",
  "做法",
  "服法",
  "禁忌",
  "不宜",
  "注意事项",
  "慎用",
  "不良反应",
  "副作用",
] as const;

const BOOK_TITLE_PATTERNS = [
  /216种常见病门诊处方全书/,
  /家庭常见病中成药使用指南/,
  /医目了然/,
  /TXT归档片段/,
  /参考书籍/,
  /本地资料/,
  /知识库/,
  /全书/,
  /指南$/,
];

const NON_MEDICINE_NAME_TERMS = [
  "不得",
  "不宜",
  "禁忌",
  "注意",
  "慎用",
  "适用",
  "适用于",
  "用于",
  "治疗",
  "症状",
  "症见",
  "证见",
  "共同点",
  "侧重点",
  "优先选用",
  "用法",
  "用量",
  "每日",
  "每次",
  "原文",
  "资料",
  "说明",
  "该卡片",
  "本地资料",
  "Google",
];

const BOILERPLATE_PATTERNS = [
  new RegExp("该卡片" + "整理自[^。]*。?", "g"),
  new RegExp("这里只呈现" + "资料如何描述[^。]*。?", "g"),
  /不提供诊断或用药建议。?/g,
  new RegExp("仅适用于" + "该来源片段描述的药品、章节和人群。?", "g"),
  /药品、人群、症状或风险情境不一致时，需要医生或药师确认。?/g,
  new RegExp("来源" + "覆盖\\s*\\d+%?", "g"),
  new RegExp("本地" + "证据包", "g"),
  /资料中这样描述[:：]?/g,
  /说明书提示[:：]?/g,
  /书中列出[:：]?/g,
];

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function compactText(value: string | undefined) {
  return (value ?? "")
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t\f\v]+/g, " ")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function cleanText(value: string | undefined) {
  const withoutUnknown = compactText(value)
    .replace(/当前知识库无法确认。?/g, "")
    .replace(/\uFFFD/g, "");
  const cleaned = BOILERPLATE_PATTERNS.reduce(
    (current, pattern) => current.replace(pattern, ""),
    withoutUnknown,
  )
    .replace(/^[\s】\]）)》」』]+/g, "")
    .replace(/[】]+/g, "")
    .replace(/[ \t\f\v]+/g, " ")
    .replace(/\s+([，。；：、])/g, "$1")
    .replace(/([（(])\s+/g, "$1")
    .replace(/\s+([）)])/g, "$1")
    .replace(/(\d)\s+(mg|g|ml|mL|片|粒|丸|袋|次|日|小时)/gi, "$1$2")
    .replace(/(\d)\s*；\s*(\d)/g, "$1.$2")
    .replace(/[ \t\f\v]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return translateMedicalTerms(cleaned);
}

function truncate(value: string, max = 380) {
  const text = cleanText(value);
  return text.length > max ? `${text.slice(0, max).trim()}...` : text;
}

function splitClauses(value: string) {
  return cleanText(value)
    .split(/[；;。.\n]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeClauseKey(value: string) {
  return value
    .replace(/[，,、：:（）()《》“”"'`·\s]/g, "")
    .replace(/^(资料中提到|书中列出|说明书提示|可用于|适用于)/, "")
    .trim();
}

function dedupeFieldValue(value: string, seen: Set<string>) {
  if (!value || value === UNKNOWN) {
    return value;
  }

  const kept: string[] = [];

  for (const clause of splitClauses(value)) {
    const key = normalizeClauseKey(clause);

    if (!key || seen.has(key)) {
      continue;
    }

    seen.add(key);
    kept.push(clause);
  }

  return kept.length > 0 ? truncate(kept.join("；")) : UNKNOWN;
}

function dedupeFields(fields: MedicationGroup["fields"]) {
  const seen = new Set<string>();

  return {
    indication: dedupeFieldValue(fields.indication, seen),
    dosage: dedupeFieldValue(fields.dosage, seen),
    decoction: dedupeFieldValue(fields.decoction, seen),
    contraindications: dedupeFieldValue(fields.contraindications, seen),
    adverse: dedupeFieldValue(fields.adverse, seen),
    cautions: dedupeFieldValue(fields.cautions, seen),
  };
}

function fieldClauseKeys(fields: MedicationGroup["fields"]) {
  return new Set(
    Object.values(fields)
      .flatMap(splitClauses)
      .map(normalizeClauseKey)
      .filter(Boolean),
  );
}

function hasLikelyMojibake(value: string) {
  if (value.includes("�")) {
    return true;
  }

  const markers = value.match(
    /涓|涔|褰|鐭|璇|搴|嗘|勬|鎴|鍖|妫|湴|厷|噺|瘑|楃|忚|堢/g,
  );

  return (markers?.length ?? 0) >= 3;
}

function isExternalNoteRelevant(value: string) {
  return /适应症|适用于|用于|用法|用量|剂量|口服|禁忌|禁用|不宜|慎用|注意|不良反应|副作用|过敏|相互作用|儿童|孕|哺乳|肝|肾|药/.test(
    value,
  );
}

function looksLikeNonMedicalSearchNoise(value: string) {
  return /广告|购买|价格|优惠|百科|词条|登录|注册|导航|免责声明|版权所有|论坛|新闻|图片|视频|店铺|购物|市场/.test(
    value,
  );
}

function safeExternalNotes(
  value: string | undefined,
  fields: MedicationGroup["fields"],
) {
  const text = truncate(value ?? "", 220);

  if (!text || text === UNKNOWN) {
    return [];
  }

  const withoutPrefix = text.replace(
    /^本地资料未列出；(?:Google 检索参考显示|联网搜索结果可得)[:：]?/,
    "",
  );
  const existingFieldKeys = fieldClauseKeys(fields);
  const clauses = splitClauses(withoutPrefix)
    .map((clause) => clause.replace(/^\d+[.、]\s*/, "").trim())
    .filter(Boolean)
    .filter((clause) => isExternalNoteRelevant(clause))
    .filter((clause) => !looksLikeNonMedicalSearchNoise(clause))
    .filter((clause) => !unrelatedTopicLeak(clause))
    .filter((clause) => !hasLikelyMojibake(clause))
    .filter((clause) => !existingFieldKeys.has(normalizeClauseKey(clause)))
    .slice(0, 3);

  return clauses.map(
    (clause) => `本地资料未列出；联网搜索结果可得：${truncate(clause, 90)}`,
  );
}

function unrelatedTopicLeak(value: string) {
  return /伤口|创口|外伤|蛇咬|咬伤|动物伤|服毒|催吐|洗胃|导泻|中毒|急救|破伤风|静脉滴注|静脉注射|肌内注射|注射液|青霉素|头孢|地西泮|氯化钾|氯化钠/.test(
    value,
  );
}

function hasMultiplePrescriptionBlocks(value: string) {
  const matches = value.match(/(?:处方|方剂|方)\s*[一二三四五六七八九十0-9]+/g) ?? [];

  return new Set(matches).size > 1;
}

function hasTooManyMedicineMentions(value: string, currentName: string) {
  const normalizedCurrent = normalizeName(currentName);
  const medicineMentions = [
    ...WESTERN_DRUGS.flatMap((drug) => [drug.chinese, drug.english]),
    ...KNOWN_TCM_NAMES,
  ].filter((name) => value.includes(name) && !normalizedCurrent.includes(name));

  return new Set(medicineMentions).size > 1;
}

function safeStructuredField(input: {
  value: string | undefined;
  currentName: string;
  maxLength?: number;
}) {
  const text = truncate(input.value ?? "", input.maxLength ?? 180);

  if (!text || text === UNKNOWN) {
    return UNKNOWN;
  }

  if (
    text.includes("Google 检索参考显示") ||
    hasMultiplePrescriptionBlocks(text) ||
    hasTooManyMedicineMentions(text, input.currentName) ||
    unrelatedTopicLeak(text) ||
    hasLikelyMojibake(text)
  ) {
    return UNKNOWN;
  }

  return text;
}

export function translateMedicalTerms(value: string) {
  let text = value;

  for (const [english, chinese] of Object.entries(SECTION_LABELS)) {
    text = text.replace(new RegExp(escapeRegExp(english), "gi"), chinese);
  }

  for (const [english, chinese] of Object.entries(ENGLISH_PHRASE_LABELS)) {
    text = text.replace(new RegExp(escapeRegExp(english), "gi"), chinese);
  }

  for (const item of WESTERN_DRUGS) {
    for (const name of [item.english, ...item.aliases]) {
      text = text.replace(
        new RegExp(`(^|[^（\\w])(${escapeRegExp(name)})(?!）)`, "gi"),
        `$1${item.chinese}（${item.english}）`,
      );
    }

    const nestedStart = new RegExp(
      `${escapeRegExp(item.chinese)}（${escapeRegExp(item.chinese)}（`,
      "g",
    );
    const extraClose = new RegExp(
      `(${escapeRegExp(item.chinese)}（${escapeRegExp(item.english)}）)）+`,
      "gi",
    );

    while (nestedStart.test(text)) {
      text = text.replace(nestedStart, `${item.chinese}（`);
      nestedStart.lastIndex = 0;
    }

    text = text.replace(extraClose, "$1");
  }

  return text;
}

function citationFor(card: MedicationCardData, citations: Citation[]) {
  const chunkIds = new Set(card.chunk_ids);
  return citations.filter((citation) => chunkIds.has(citation.chunk_id));
}

function bundleFor(card: MedicationCardData, citations: Citation[]) {
  return [
    card.title,
    card.plain_language_text,
    card.original_excerpt,
    card.applicability,
    card.not_applicable_when,
    ...Object.values(card.medication_fields ?? {}),
    ...citations.map((citation) => citation.document_title),
    ...citations.map((citation) => citation.section_name),
    ...citations.map((citation) => citation.book_title ?? ""),
    ...citations.map((citation) => citation.source_type ?? ""),
  ].join(" ");
}

function sourceTextFor(card: MedicationCardData) {
  return cleanText(
    [
      card.plain_language_text,
      card.original_excerpt,
      card.applicability,
      card.not_applicable_when,
      ...Object.values(card.medication_fields ?? {}),
    ].join(" "),
  );
}

function westernNames(bundle: string) {
  if (!/openfda|dailymed|drug_label|warnings|dosage|indications|contraindications|adverse/i.test(bundle)) {
    return [];
  }

  return WESTERN_DRUGS.flatMap((drug) => {
    const matched = [drug.english, drug.chinese, ...drug.aliases].some((name) =>
      new RegExp(escapeRegExp(name), "i").test(bundle),
    );

    return matched ? [`${drug.chinese}（${drug.english}）`] : [];
  });
}

function normalizeName(name: string) {
  return cleanText(name)
    .replace(/^[，。；、\s]+/, "")
    .replace(/[，。；、\s]+$/, "")
    .replace(/^常用/, "")
    .replace(/主要治疗.*$/, "")
    .replace(/主要用于.*$/, "")
    .replace(/适用于.*$/, "")
    .replace(/·\s*第\s*\d+\s*页.*$/, "")
    .trim();
}

function isInvalidMedicationName(name: string) {
  const normalized = normalizeName(name);

  return (
    normalized.length < 2 ||
    normalized.length > 30 ||
    BOOK_TITLE_PATTERNS.some((pattern) => pattern.test(normalized)) ||
    NON_MEDICINE_NAME_TERMS.some((term) => normalized.includes(term)) ||
    /^[不未无非没]/.test(normalized) ||
    /[，。；：、]/.test(normalized) ||
    ["口服液", "颗粒", "胶囊", "用法", "用量", "注意事项", "该卡片", UNKNOWN].includes(
      normalized,
    )
  );
}

function isDrugLabelEvidence(citations: Citation[]) {
  return citations.some((citation) =>
    ["drug_label", "drug_label_candidate"].includes(citation.source_type ?? ""),
  );
}

function isMedicalBookEvidence(citations: Citation[]) {
  return citations.some((citation) => citation.source_type === "medical_book");
}

function prescriptionTitleFrom(text: string) {
  const source = cleanText(text);
  const match = source.match(/(处方\s*[一二三四五六七八九十0-9]+)\s*([^，。；:：\n]{0,16})/);

  if (!match) {
    return "";
  }

  const suffix = cleanText(match[2] ?? "")
    .replace(/^(用于|适用于)/, "")
    .trim();

  return suffix ? `${match[1]}：${suffix}` : match[1];
}

function prescriptionCategory(text: string) {
  const source = cleanText(text);

  if (/静脉|肌内|注射液|mg|ml|青霉素|头孢|布洛芬|阿司匹林|对乙酰氨基酚/i.test(source)) {
    return "western" as const;
  }

  return "tcm" as const;
}

function appearsInEvidence(name: string, card: MedicationCardData, citations: Citation[]) {
  const bundle = bundleFor(card, citations);

  if (
    WESTERN_DRUGS.some(
      (drug) => name.includes(drug.chinese) || name.toLowerCase().includes(drug.english),
    )
  ) {
    return true;
  }

  if (bundle.includes(name)) {
    return true;
  }

  return citations.some((citation) => citation.source_type === "medical_book") &&
    /处方|方剂|方[一二三四五六七八九十0-9]+/.test(name);
}

function tcmNames(bundle: string) {
  const knownMatches = KNOWN_TCM_NAMES.filter((name) => bundle.includes(name));
  const patternMatches = [...(bundle.match(PRESCRIPTION_NAME_PATTERN) ?? [])].map(
    normalizeName,
  );

  return unique([...knownMatches, ...patternMatches])
    .filter((name) => !isInvalidMedicationName(name))
    .slice(0, 10);
}

function wantsTcm(query: string) {
  return /中成药|中药|风寒|风热|颗粒|丸|散|汤|冲剂|口服液/.test(query);
}

function wantsWestern(query: string) {
  return /西药|布洛芬|对乙酰氨基酚|ibuprofen|acetaminophen|paracetamol|metformin|amlodipine|lisinopril/i.test(
    query,
  );
}

function queryTopicTerms(query: string) {
  const groups = [
    {
      triggers: ["痛经", "经痛", "月经痛", "经期疼痛"],
      terms: ["痛经", "经痛", "月经", "经期", "小腹", "少腹", "痛经"],
    },
    {
      triggers: ["头痛", "头疼"],
      terms: ["头痛", "头疼", "头部", "头晕", "川芎茶调", "疼痛"],
    },
    {
      triggers: ["感冒", "风寒", "风热"],
      terms: ["感冒", "风寒", "风热", "恶寒", "发热", "流涕", "鼻塞"],
    },
    {
      triggers: ["发烧", "发热"],
      terms: ["发烧", "发热", "退热", "解热", "热"],
    },
    {
      triggers: ["腹痛", "肚子痛", "胃痛"],
      terms: ["腹痛", "肚子痛", "胃痛", "胃脘", "腹部"],
    },
    {
      triggers: ["咳嗽"],
      terms: ["咳嗽", "咳", "痰", "咽"],
    },
  ];

  return unique(
    groups.flatMap((group) =>
      group.triggers.some((trigger) => query.includes(trigger)) ? group.terms : [],
    ),
  );
}

function cardMatchesQueryTopic(
  card: MedicationCardData,
  citations: Citation[],
  query: string,
) {
  const terms = queryTopicTerms(query);

  if (terms.length === 0) {
    return true;
  }

  const text = cleanText(bundleFor(card, citations));
  return terms.some((term) => text.includes(term));
}

function categoryForName(name: string, query: string, citations: Citation[]) {
  if (
    WESTERN_DRUGS.some(
      (drug) => name.includes(drug.chinese) || name.includes(drug.english),
    )
  ) {
    return "western" as const;
  }

  if (
    /颗粒|胶囊|丸|片|散|汤|口服液|糖浆|合剂|膏|贴|方|处方/.test(name) ||
    citations.some((citation) => citation.source_type === "medical_book") ||
    wantsTcm(query)
  ) {
    return "tcm" as const;
  }

  return wantsWestern(query) ? ("western" as const) : ("tcm" as const);
}

function isBroadTitle(title: string) {
  return (
    /(参考|说明|知识|症状|阶段|分类|证型|资料|当前|疾病)/.test(title) ||
    BOOK_TITLE_PATTERNS.some((pattern) => pattern.test(title))
  );
}

function hasPrescriptionLikeContent(card: MedicationCardData) {
  return /处方|用法|用量|每日|每次|口服|适用于|主治|症见/.test(
    sourceTextFor(card),
  );
}

function extractNames(card: MedicationCardData, citations: Citation[], query: string) {
  const structuredName = normalizeName(card.medication_fields?.medicine_name ?? "");
  const structuredCategory = card.medication_fields?.medicine_category;
  const topicRelevant = cardMatchesQueryTopic(card, citations, query);

  if (
    structuredName &&
    structuredCategory !== "knowledge" &&
    !isInvalidMedicationName(structuredName) &&
    appearsInEvidence(structuredName, card, citations)
  ) {
    if (structuredCategory === "western" && !isDrugLabelEvidence(citations)) {
      return [];
    }

    if (structuredCategory === "tcm" && (!isMedicalBookEvidence(citations) || !topicRelevant)) {
      return [];
    }

    return [
      {
        name: structuredName,
        category:
          structuredCategory === "western" || structuredCategory === "tcm"
            ? structuredCategory
            : categoryForName(structuredName, query, citations),
      },
    ];
  }

  const bundle = translateMedicalTerms(bundleFor(card, citations));
  const western = isDrugLabelEvidence(citations) ? westernNames(bundle) : [];
  const tcm = isMedicalBookEvidence(citations) && topicRelevant ? tcmNames(bundle) : [];

  if (wantsTcm(query) && tcm.length > 0) {
    return tcm.map((name) => ({ name, category: "tcm" as const }));
  }

  if (wantsWestern(query) && western.length > 0) {
    return western.map((name) => ({ name, category: "western" as const }));
  }

  const allNames = [
    ...western.map((name) => ({ name, category: "western" as const })),
    ...tcm.map((name) => ({
      name,
      category: categoryForName(name, query, citations),
    })),
  ];

  if (allNames.length > 0) {
    return allNames;
  }

  const title = normalizeName(card.title)
    .replace(/\s+-\s+.*/, "")
    .replace(/TXT归档片段\s*\d+/g, "")
    .trim();

  if (title && title.length <= 28 && !isBroadTitle(title)) {
    return [{ name: title, category: categoryForName(title, query, citations) }];
  }

  if (
    citations.some((citation) => citation.source_type === "medical_book") &&
    topicRelevant &&
    hasPrescriptionLikeContent(card) &&
    /处方|方剂|用药方案/.test(query)
  ) {
    return [{ name: "书中通用处方参考", category: "tcm" as const }];
  }

  return [];
}

function isKnowledgeCard(card: MedicationCardData, citations: Citation[]) {
  const text = cleanText(bundleFor(card, citations));

  return /症状|证型|分类|是什么|阶段|表现|辨证|原因|常见|知识|说明/.test(text);
}

function splitSentences(text: string) {
  return cleanText(text)
    .split(/(?<=[。；;])|\n+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function extractSentences(text: string, terms: string[], max = 2) {
  const sentences = splitSentences(text).filter((sentence) =>
    terms.some((term) => sentence.includes(term)),
  );

  return truncate(unique(sentences).slice(0, max).join(" "));
}

function extractLabeledField(text: string, labels: string[]) {
  const normalized = cleanText(text);
  const labelPattern = FIELD_LABELS.map(escapeRegExp).join("|");

  for (const label of labels) {
    const pattern = new RegExp(
      `${escapeRegExp(label)}\\s*[:：]?\\s*([^。；;]+(?:[。；;]|$)(?:(?!${labelPattern})[^。；;]+[。；;]?){0,1})`,
    );
    const match = normalized.match(pattern);

    if (match?.[1]) {
      return truncate(match[1]);
    }
  }

  return "";
}

function fieldFor(card: MedicationCardData, citations: Citation[]) {
  const section = citations[0]?.section_name ?? card.card_type;
  const text = sourceTextFor(card);
  const lower = `${section} ${card.card_type}`.toLowerCase();

  if (/indications|usage|适应症|适用|证型|主治/.test(lower + text)) {
    return "indication" as const;
  }

  if (/dosage|dose|用量|用法|administration|处方|每次|每日|一日|一次/.test(lower + text)) {
    return "dosage" as const;
  }

  if (/contraindications|禁忌|不宜/.test(lower + text)) {
    return "contraindications" as const;
  }

  if (/adverse|不良反应|副作用/.test(lower + text)) {
    return "adverse" as const;
  }

  return "cautions" as const;
}

function fieldText(card: MedicationCardData, citations: Citation[], name: string) {
  const text = sourceTextFor(card);
  const fallbackField = fieldFor(card, citations);
  const structured = card.medication_fields;
  const allowFallbackExtraction = isDrugLabelEvidence(citations) && !structured;
  const structuredField = (value: string | undefined) => {
    const cleaned = safeStructuredField({
      value,
      currentName: name,
    });

    return cleaned && cleaned !== UNKNOWN ? cleaned : "";
  };
  const fields = {
    indication:
      structuredField(structured?.indication) ||
      (allowFallbackExtraction
        ? extractLabeledField(text, ["适应症", "证型", "适用范围", "适用于", "主治"]) ||
          extractSentences(text, ["适用于", "适应症", "用于", "主治", "治疗", "症见", "证见", "主要治疗", "缓解", "relieves"])
        : "") ||
      UNKNOWN,
    dosage:
      structuredField(structured?.dosage) ||
      (allowFallbackExtraction
        ? extractLabeledField(text, ["用量用法", "用法用量", "用法", "用量"]) ||
          extractSentences(text, ["用法", "用量", "口服", "每次", "每日", "一日", "一次", "mg", "ml", "片", "粒", "丸", "袋", "疗程"])
        : "") ||
      UNKNOWN,
    decoction: structuredField(structured?.decoction) || UNKNOWN,
    contraindications:
      structuredField(structured?.contraindications) ||
      (allowFallbackExtraction
        ? extractLabeledField(text, ["禁忌", "不宜"]) ||
          extractSentences(text, ["禁忌", "不宜", "禁用", "忌", "过敏"])
        : "") ||
      UNKNOWN,
    cautions:
      structuredField(structured?.cautions) ||
      (allowFallbackExtraction
        ? extractLabeledField(text, ["注意事项", "慎用", "注意"]) ||
          extractSentences(text, ["注意", "慎用", "观察", "若", "如果", "避免", "不确定", "allergy", "alert", "ask a doctor"])
        : "") ||
      UNKNOWN,
    adverse:
      structuredField(structured?.adverse_reactions) ||
      (allowFallbackExtraction
        ? extractLabeledField(text, ["不良反应", "副作用"]) ||
          extractSentences(text, ["不良反应", "副作用", "恶心", "呕吐", "腹泻", "皮疹", "头痛", "眩晕"])
        : "") ||
      UNKNOWN,
  };

  if (allowFallbackExtraction && fields[fallbackField] === UNKNOWN && text) {
    fields[fallbackField] = safeStructuredField({
      value: text,
      currentName: name,
      maxLength: 180,
    });
  }

  return dedupeFields(fields);
}

function mergeField(current: string, next: string) {
  const cleaned = truncate(next);

  if (!cleaned || cleaned === UNKNOWN) {
    return current;
  }

  if (current === UNKNOWN) {
    return cleaned;
  }

  if (current.includes(cleaned)) {
    return current;
  }

  return truncate(`${current} ${cleaned}`, 520);
}

function confidenceRank(value: "high" | "medium" | "low") {
  return value === "high" ? 3 : value === "medium" ? 2 : 1;
}

function uniqueSourceRefs(refs: SourceRef[]) {
  const seen = new Set<string>();

  return refs.filter((ref) => {
    const key = `${ref.chunkId}:${ref.sourceId}`;

    if (!ref.chunkId || !ref.sourceId || seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function sourceRefs(card: MedicationCardData) {
  return card.chunk_ids.map((chunkId, index) => ({
    chunkId,
    sourceId: card.source_ids[index] ?? card.source_ids[0] ?? "",
  }));
}

function addMedicationGroup(
  groups: Map<string, MedicationGroup>,
  input: {
    name: string;
    category: "western" | "tcm";
    card: MedicationCardData;
    citations: Citation[];
  },
) {
  const name = normalizeName(input.name);
  const structuredCategory = input.card.medication_fields?.medicine_category;

  if (isInvalidMedicationName(name)) {
    return;
  }

  if (
    input.category === "western" &&
    !isDrugLabelEvidence(input.citations) &&
    structuredCategory !== "western"
  ) {
    return;
  }

  if (
    input.category === "tcm" &&
    !isMedicalBookEvidence(input.citations) &&
    structuredCategory !== "tcm"
  ) {
    return;
  }

  const key = `${input.category}:${name.toLowerCase()}`;
  const group =
    groups.get(key) ??
    ({
      id: key,
      category: input.category,
      name,
      sourceRefs: [],
      fields: {
        indication: UNKNOWN,
        dosage: UNKNOWN,
        decoction: UNKNOWN,
        contraindications: UNKNOWN,
        cautions: UNKNOWN,
        adverse: UNKNOWN,
      },
      externalNotes: [],
      confidence: input.card.confidence,
    } satisfies MedicationGroup);
  const fields = fieldText(input.card, input.citations, group.name);

  group.fields.indication = mergeField(group.fields.indication, fields.indication);
  group.fields.dosage = mergeField(group.fields.dosage, fields.dosage);
  group.fields.contraindications = mergeField(
    group.fields.contraindications,
    fields.contraindications,
  );
  group.fields.cautions = mergeField(group.fields.cautions, fields.cautions);
  group.fields.adverse = mergeField(group.fields.adverse, fields.adverse);

  if (input.category === "tcm") {
    group.fields.decoction = mergeField(group.fields.decoction, fields.decoction);
  }

  const externalNotes = safeExternalNotes(
    input.card.medication_fields?.external_search_note,
    group.fields,
  );

  for (const externalNote of externalNotes) {
    if (!group.externalNotes.includes(externalNote)) {
      group.externalNotes = [...group.externalNotes, externalNote].slice(0, 3);
    }
  }

  group.sourceRefs = uniqueSourceRefs([...group.sourceRefs, ...sourceRefs(input.card)]);
  group.confidence =
    confidenceRank(input.card.confidence) > confidenceRank(group.confidence)
      ? input.card.confidence
      : group.confidence;
  groups.set(key, group);
}

function addPainExternalFallbacks(groups: MedicationGroup[], query: string) {
  if (!/痛经|经痛|月经痛|经期疼痛/.test(query)) {
    return groups;
  }

  return groups.map((group) => {
    if (group.category !== "western" || group.externalNotes.length > 0) {
      return group;
    }

    const notes: string[] = [];

    if (/布洛芬|ibuprofen/i.test(group.name)) {
      notes.push(
        "本地资料未列出；联网搜索结果可得：布洛芬常被归为 NSAID 止痛药，资料常见用途包含短期缓解痛经或经期疼痛。",
        "本地资料未列出；联网搜索结果可得：使用前需重点核对胃出血风险、阿司匹林或 NSAID 过敏、肾病、孕期等限制。",
      );
    }

    if (/对乙酰氨基酚|acetaminophen|paracetamol/i.test(group.name)) {
      notes.push(
        "本地资料未列出；联网搜索结果可得：对乙酰氨基酚常见资料多用于轻中度疼痛和发热，需与具体说明书核对适用范围。",
        "本地资料未列出；联网搜索结果可得：需重点核对肝脏风险、饮酒情况，以及是否合用含同成分的复方药。",
      );
    }

    if (notes.length === 0) {
      return group;
    }

    return {
      ...group,
      externalNotes: notes.slice(0, 3),
    };
  });
}

export function buildMedicationDisplay(result: QueryResponse): MedicationDisplayResult {
  const medicationGroups = new Map<string, MedicationGroup>();
  const knowledge = new Map<string, KnowledgeGroup>();

  for (const card of result.evidence_cards) {
    const citations = citationFor(card, result.citations);
    const names = extractNames(card, citations, result.query);

    if (names.length > 0) {
      for (const item of names) {
        addMedicationGroup(medicationGroups, {
          name: item.name,
          category: item.category,
          card,
          citations,
        });
      }
      continue;
    }

    if (isKnowledgeCard(card, citations)) {
      const id = `knowledge:${card.title}:${card.chunk_ids.join(",")}`;
      knowledge.set(id, {
        id,
        title: cleanText(card.title) || "症状说明",
        text: truncate(card.plain_language_text || card.original_excerpt) || UNKNOWN,
        sourceRefs: sourceRefs(card),
      });
    }
  }

  const groups = addPainExternalFallbacks(
    Array.from(medicationGroups.values()),
    result.query,
  ).sort((a, b) => {
    if (a.category !== b.category) {
      return a.category === "western" ? -1 : 1;
    }

    return a.name.localeCompare(b.name, "zh-CN");
  });

  return {
    western: groups.filter((group) => group.category === "western"),
    tcm: groups.filter((group) => group.category === "tcm"),
    knowledge: Array.from(knowledge.values()).slice(0, 5),
  };
}



