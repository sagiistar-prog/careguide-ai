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

  return toLikePatterns([
    ...query.book_query_terms.common_disease_terms,
    ...query.book_query_terms.tcm_pattern_terms,
    ...query.book_query_terms.book_intent_terms,
    ...query.book_query_terms.prescription_structure_terms,
    ...query.expanded_terms,
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

  if (query.detected_symptoms.some((term) => ["胃痛", "腹痛", "肚子痛"].includes(term))) {
    symptomSpecific.push("保和丸", "大山楂丸", "附子理中丸", "黄连上清丸");
  }

  if (query.detected_symptoms.includes("中暑")) {
    symptomSpecific.push("藿香正气水", "藿香正气胶囊");
  }

  return toLikePatterns([
    ...KNOWN_MEDICINE_CANDIDATE_TERMS,
    ...MEDICINE_FORM_TERMS,
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
