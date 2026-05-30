import {
  KNOWN_MEDICINE_CANDIDATE_TERMS,
  MEDICINE_FORM_TERMS,
  PRESCRIPTION_STRUCTURE_TERMS,
} from "./book-query-lexicon";
import type { KeywordSearchResult, NormalizedQuery, RetrievalDb } from "./types";

type KeywordRow = {
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
  keyword_score: number;
  content_signals: string[] | null;
};

function asDateString(value: unknown) {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }

  return typeof value === "string" ? value : null;
}

function cleanFullTextTerm(term: string) {
  return term
    .replace(/[^a-zA-Z0-9 -]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildSearchText(query: NormalizedQuery) {
  const terms = query.search_terms
    .map(cleanFullTextTerm)
    .filter((term) => term.length > 1);

  return Array.from(new Set(terms)).join(" OR ");
}

function escapeLike(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

function toLikePatterns(terms: readonly string[]) {
  return Array.from(
    new Set(
      terms
        .filter((term) => /[\u3400-\u9fff]/.test(term))
        .filter((term) => term.length >= 2)
        .map((term) => `%${escapeLike(term)}%`),
    ),
  );
}

function buildChineseBookPatterns(query: NormalizedQuery) {
  if (!query.book_intent) {
    return [];
  }

  const genericBookTerms = new Set([
    "中成药",
    "中药",
    "处方",
    "适用于",
    "适应症",
    "用法",
    "用量",
    "注意",
    "禁忌",
    "慎用",
  ]);
  const exactTopicTerms = [
    ...query.book_query_terms.common_disease_terms,
    ...query.book_query_terms.tcm_pattern_terms,
    ...query.detected_symptoms,
  ];
  const expandedTerms =
    exactTopicTerms.length > 0
      ? query.expanded_terms.filter((term) => !genericBookTerms.has(term))
      : query.expanded_terms;

  return toLikePatterns([
    ...query.book_query_terms.common_disease_terms,
    ...query.book_query_terms.tcm_pattern_terms,
    ...query.book_query_terms.book_intent_terms.filter(
      (term) => exactTopicTerms.length === 0 || !genericBookTerms.has(term),
    ),
    ...query.book_query_terms.prescription_structure_terms.filter(
      (term) => exactTopicTerms.length === 0 || !genericBookTerms.has(term),
    ),
    ...expandedTerms,
    ...(query.medication_preference === "tcm" ? MEDICINE_FORM_TERMS : []),
  ]).slice(0, 32);
}

function buildMedicineCandidatePatterns(query: NormalizedQuery) {
  const wantsMedicine =
    query.book_intent ||
    query.medication_preference === "tcm" ||
    query.question_type === "find_medicine" ||
    query.question_type === "prescription";

  if (!wantsMedicine) {
    return [];
  }

  const symptomSpecific: string[] = [];

  if (query.detected_symptoms.some((term) => ["感冒", "咳嗽", "发热", "发烧"].includes(term))) {
    symptomSpecific.push(
      "感冒清热颗粒",
      "风寒感冒颗粒",
      "荆防颗粒",
      "小青龙合剂",
      "通宣理肺丸",
      "止嗽宁嗽胶囊",
      "杏苏止咳糖浆",
      "银翘解毒片",
      "双黄连口服液",
      "布洛芬",
      "对乙酰氨基酚",
    );
  }

  if (query.detected_symptoms.some((term) => ["头痛", "头疼", "疼痛", "止痛"].includes(term))) {
    symptomSpecific.push("布洛芬", "对乙酰氨基酚", "元胡止痛片", "少腹逐瘀颗粒");
  }

  if (query.detected_symptoms.some((term) => ["痛经", "经痛"].includes(term))) {
    symptomSpecific.push("布洛芬", "对乙酰氨基酚", "月经痛", "痛经", "经期疼痛");
  }

  if (
    query.detected_symptoms.some((term) =>
      ["胃痛", "腹痛", "肚子痛", "腹泻", "拉肚子", "急性肠胃炎", "肠胃炎", "胃肠炎", "恶心", "呕吐"].includes(term),
    )
  ) {
    symptomSpecific.push(
      "口服补液盐",
      "蒙脱石散",
      "益生菌",
      "洛哌丁胺",
      "黄连素",
      "藿香正气水",
      "藿香正气胶囊",
      "保和丸",
      "大山楂丸",
      "附子理中丸",
      "黄连上清丸",
    );
  }

  if (query.detected_symptoms.includes("中暑")) {
    symptomSpecific.push("藿香正气水", "藿香正气胶囊");
  }

  if (query.detected_symptoms.some((term) => ["头晕", "头昏", "眩晕"].includes(term))) {
    symptomSpecific.push("倍他司汀", "茶苯海明", "美克洛嗪", "小柴胡颗粒");
  }

  if (
    query.detected_symptoms.some((term) =>
      ["心率过速", "心动过速", "窦性心率过速", "窦性心动过速", "心悸", "心慌"].includes(term),
    )
  ) {
    symptomSpecific.push("美托洛尔", "比索洛尔", "普萘洛尔", "稳心颗粒");
  }

  if (query.search_terms.some((term) => ["高血压", "血压高"].includes(term))) {
    symptomSpecific.push("降压", "三子降压汤", "天麻钩藤饮", "氨氯地平", "赖诺普利");
  }

  if (query.search_terms.some((term) => ["糖尿病", "高血糖", "血糖高"].includes(term))) {
    symptomSpecific.push("二甲双胍", "metformin", "胰岛素", "消渴");
  }

  if (query.search_terms.some((term) => ["低血糖", "血糖过低"].includes(term))) {
    symptomSpecific.push("葡萄糖", "胰高血糖素", "糖");
  }

  const broadCatalog =
    query.medication_preference === "tcm"
      ? [...KNOWN_MEDICINE_CANDIDATE_TERMS, ...MEDICINE_FORM_TERMS]
      : [];

  return toLikePatterns([
    ...broadCatalog,
    ...symptomSpecific,
  ]);
}

function buildPrescriptionStructurePatterns(query: NormalizedQuery) {
  if (!query.book_intent && query.question_type !== "find_medicine") {
    return [];
  }

  return toLikePatterns([
    ...PRESCRIPTION_STRUCTURE_TERMS,
    "主治",
    "功效",
    "症见",
    "一次",
    "一日",
    "每日",
    "每次",
  ]);
}

function matchedTerms(row: KeywordRow, query: NormalizedQuery) {
  const haystack = [
    row.source_id,
    row.source_type,
    row.section_name,
    row.section_key,
    row.document_title,
    row.book_title ?? "",
    row.location ?? "",
    ...(row.content_signals ?? []),
  ]
    .join(" ")
    .toLowerCase();

  return query.search_terms
    .filter((term) => term.length > 1)
    .filter((term) => haystack.includes(term.toLowerCase()))
    .slice(0, 12);
}

export async function keywordSearch(input: {
  db: RetrievalDb;
  query: NormalizedQuery;
  topK: number;
}): Promise<KeywordSearchResult[]> {
  const searchText = buildSearchText(input.query);
  const chineseBookPatterns = buildChineseBookPatterns(input.query);
  const medicineCandidatePatterns = buildMedicineCandidatePatterns(input.query);
  const prescriptionStructurePatterns =
    buildPrescriptionStructurePatterns(input.query);
  const rows: KeywordRow[] = [];

  if (!searchText && chineseBookPatterns.length === 0) {
    return [];
  }

  if (searchText) {
    rows.push(
      ...(await input.db<KeywordRow[]>`
        with q as (
          select websearch_to_tsquery('english', ${searchText}) as query
        )
        select
          sc.id as chunk_id,
          sc.source_document_id,
          sc.source_id,
          sd.source_type,
          sc.section_title as section_name,
          sc.section_key,
          sd.document_title,
          sd.source_institution as source_organization,
          sc.published_at,
          sc.updated_at as source_updated_at,
          sc.chunk_index,
          sc.scenario_tags,
          sd.medicine_names,
          sd.ingredient_names,
          sc.applicable_populations,
          sc.book_title,
          sc.page_start,
          sc.page_end,
          sc.location,
          ts_rank_cd(sc.search_vector, q.query) as keyword_score,
          array[]::text[] as content_signals
        from public.source_chunks sc
        join public.source_documents sd on sd.id = sc.source_document_id
        cross join q
        where sc.answer_eligible = true
          and sc.search_vector @@ q.query
        order by keyword_score desc, sc.created_at asc
        limit ${input.topK}
      `),
    );
  }

  if (chineseBookPatterns.length > 0) {
    rows.push(
      ...(await input.db<KeywordRow[]>`
        select
          sc.id as chunk_id,
          sc.source_document_id,
          sc.source_id,
          sd.source_type,
          sc.section_title as section_name,
          sc.section_key,
          sd.document_title,
          sd.source_institution as source_organization,
          sc.published_at,
          sc.updated_at as source_updated_at,
          sc.chunk_index,
          sc.scenario_tags,
          sd.medicine_names,
          sd.ingredient_names,
          sc.applicable_populations,
          sc.book_title,
          sc.page_start,
          sc.page_end,
          sc.location,
          (
            case when sd.source_type = 'medical_book' then 0.35 else 0 end +
            case
              when exists (
                select 1 from unnest(${chineseBookPatterns}::text[]) as p(pattern)
                where sc.original_text ilike p.pattern escape E'\\\\'
              ) then 0.45 else 0
            end +
            case
              when exists (
                select 1 from unnest(${chineseBookPatterns}::text[]) as p(pattern)
                where sc.section_title ilike p.pattern escape E'\\\\'
              ) then 0.25 else 0
            end +
            case
              when exists (
                select 1 from unnest(${chineseBookPatterns}::text[]) as p(pattern)
                where coalesce(sc.book_title, sd.document_title) ilike p.pattern escape E'\\\\'
              ) then 0.15 else 0
            end +
            case
              when exists (
                select 1 from unnest(${medicineCandidatePatterns}::text[]) as p(pattern)
                where sc.original_text ilike p.pattern escape E'\\\\'
                  or sc.section_title ilike p.pattern escape E'\\\\'
              ) then 0.62 else 0
            end +
            case
              when exists (
                select 1 from unnest(${prescriptionStructurePatterns}::text[]) as p(pattern)
                where sc.original_text ilike p.pattern escape E'\\\\'
              ) then 0.32 else 0
            end
          ) as keyword_score,
          array(
            select regexp_replace(p.pattern, '%', '', 'g')
            from unnest(${chineseBookPatterns}::text[]) as p(pattern)
            where sc.original_text ilike p.pattern escape E'\\\\'
              or sc.section_title ilike p.pattern escape E'\\\\'
          ) ||
          array(
            select regexp_replace(p.pattern, '%', '', 'g')
            from unnest(${medicineCandidatePatterns}::text[]) as p(pattern)
            where sc.original_text ilike p.pattern escape E'\\\\'
              or sc.section_title ilike p.pattern escape E'\\\\'
          ) ||
          array(
            select regexp_replace(p.pattern, '%', '', 'g')
            from unnest(${prescriptionStructurePatterns}::text[]) as p(pattern)
            where sc.original_text ilike p.pattern escape E'\\\\'
          ) as content_signals
        from public.source_chunks sc
        join public.source_documents sd on sd.id = sc.source_document_id
        where sc.answer_eligible = true
          and exists (
            select 1 from unnest(${chineseBookPatterns}::text[]) as p(pattern)
            where sc.original_text ilike p.pattern escape E'\\\\'
              or sc.section_title ilike p.pattern escape E'\\\\'
              or coalesce(sc.book_title, sd.document_title) ilike p.pattern escape E'\\\\'
          )
        order by keyword_score desc,
          case when sd.source_type = 'medical_book' then 0 else 1 end,
          sc.created_at asc
        limit ${Math.max(input.topK, 50)}
      `),
    );
  }

  const deduped = Array.from(
    rows
      .reduce((map, row) => {
        const existing = map.get(row.chunk_id);

        if (!existing || Number(row.keyword_score) > Number(existing.keyword_score)) {
          map.set(row.chunk_id, row);
        }

        return map;
      }, new Map<string, KeywordRow>())
      .values(),
  )
    .sort((a, b) => Number(b.keyword_score) - Number(a.keyword_score))
    .slice(0, input.topK);

  return deduped.map((row, index) => ({
    ...row,
    published_at: asDateString(row.published_at),
    source_updated_at: asDateString(row.source_updated_at),
    keyword_rank: index + 1,
    keyword_score: Number(row.keyword_score),
    matched_terms: matchedTerms(row, input.query),
    content_signals: row.content_signals ?? [],
  }));
}
