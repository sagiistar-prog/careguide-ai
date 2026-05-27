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

const KNOWN_TCM_NAMES = [
  "抗病毒口服液",
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
  return (value ?? "").replace(/\s+/g, " ").trim();
}

function cleanText(value: string | undefined) {
  const withoutUnknown = compactText(value).replace(/当前知识库无法确认。?/g, "");
  const cleaned = BOILERPLATE_PATTERNS.reduce(
    (current, pattern) => current.replace(pattern, ""),
    withoutUnknown,
  )
    .replace(/[】]+/g, "")
    .replace(/\s+/g, " ")
    .replace(/\s+([，。；：、])/g, "$1")
    .replace(/([（(])\s+/g, "$1")
    .replace(/\s+([）)])/g, "$1")
    .replace(/(\d)\s+(mg|g|ml|mL|片|粒|丸|袋|次|日|小时)/gi, "$1$2")
    .replace(/(\d)\s*；\s*(\d)/g, "$1.$2")
    .replace(/\s+/g, " ")
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

function safeExternalNote(value: string | undefined) {
  const text = truncate(value ?? "", 160);

  if (!text || text === UNKNOWN) {
    return "";
  }

  return text.startsWith("本地资料未列出；Google 检索参考显示")
    ? text
    : `本地资料未列出；Google 检索参考显示：${text}`;
}

function unrelatedTopicLeak(value: string) {
  return /伤口|咬伤|服毒|催吐|洗胃|导泻|中毒|静脉滴注|肌内注射|青霉素|头孢|地西泮|氯化钾|氯化钠/.test(
    value,
  );
}

function hasMultiplePrescriptionBlocks(value: string) {
  const matches = value.match(/处方\s*[一二三四五六七八九十0-9]+/g) ?? [];

  return new Set(matches).size > 1;
}

function hasTooManyMedicineMentions(value: string, currentName: string) {
  const normalizedCurrent = normalizeName(currentName);
  const medicineMentions = [
    ...WESTERN_DRUGS.flatMap((drug) => [drug.chinese, drug.english]),
    ...KNOWN_TCM_NAMES,
  ].filter((name) => value.includes(name) && !normalizedCurrent.includes(name));

  return new Set(medicineMentions).size > 2;
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
    hasMultiplePrescriptionBlocks(text) ||
    hasTooManyMedicineMentions(text, input.currentName) ||
    unrelatedTopicLeak(text)
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

  for (const item of WESTERN_DRUGS) {
    for (const name of [item.english, ...item.aliases]) {
      text = text.replace(
        new RegExp(`\\b${escapeRegExp(name)}\\b`, "gi"),
        `${item.chinese}（${item.english}）`,
      );
    }
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

  if (
    structuredName &&
    structuredCategory !== "knowledge" &&
    !isInvalidMedicationName(structuredName) &&
    appearsInEvidence(structuredName, card, citations)
  ) {
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
  const western = westernNames(bundle);
  const tcm = tcmNames(bundle);

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
    hasPrescriptionLikeContent(card)
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
  const structuredField = (value: string | undefined) => {
    const cleaned = safeStructuredField({
      value,
      currentName: name,
    });

    return cleaned && cleaned !== UNKNOWN ? cleaned : "";
  };
  const allowFallbackExtraction = !structured;
  const fields = {
    indication:
      structuredField(structured?.indication) ||
      (allowFallbackExtraction
        ? extractLabeledField(text, ["适应症", "证型", "适用范围", "适用于", "主治"]) ||
          extractSentences(text, ["适用于", "适应症", "用于", "主治", "治疗", "症见", "证见", "主要治疗", "缓解"])
        : "") ||
      UNKNOWN,
    dosage:
      structuredField(structured?.dosage) ||
      (allowFallbackExtraction
        ? extractLabeledField(text, ["用量用法", "用法用量", "用法", "用量"]) ||
          extractSentences(text, ["用法", "用量", "口服", "每次", "每日", "一日", "一次", "mg", "ml", "片", "粒", "丸", "袋", "疗程"])
        : "") ||
      UNKNOWN,
    decoction:
      structuredField(structured?.decoction) ||
      (allowFallbackExtraction
        ? extractLabeledField(text, ["煎法", "做法", "服法"]) ||
          extractSentences(text, ["煎服", "水煎", "冲服", "外用", "煎煮", "开水冲服", "温水"])
        : "") ||
      UNKNOWN,
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
          extractSentences(text, ["注意", "慎用", "观察", "若", "如果", "避免", "不确定"])
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
    fields[fallbackField] = truncate(text);
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

  if (isInvalidMedicationName(name)) {
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

  const externalNote = safeExternalNote(input.card.medication_fields?.external_search_note);

  if (externalNote && !group.externalNotes.includes(externalNote)) {
    group.externalNotes = [...group.externalNotes, externalNote].slice(0, 2);
  }

  group.sourceRefs = uniqueSourceRefs([...group.sourceRefs, ...sourceRefs(input.card)]);
  group.confidence =
    confidenceRank(input.card.confidence) > confidenceRank(group.confidence)
      ? input.card.confidence
      : group.confidence;
  groups.set(key, group);
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

  const groups = Array.from(medicationGroups.values()).sort((a, b) => {
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



