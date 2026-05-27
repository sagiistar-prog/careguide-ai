import { hybridSearch } from "../../lib/retrieval/hybrid-search";
import { closeAdminClient, createAdminClient } from "../ingest/lib/db";
import { getScriptEnv } from "../ingest/lib/script-env";

const TEST_QUERIES = [
  "儿童发烧可以看哪些退烧药说明？",
  "acetaminophen 有哪些 warnings？",
  "ibuprofen 对儿童有什么警示？",
  "metformin 有哪些不良反应？",
  "高血压患者看 amlodipine 说明书需要注意什么？",
  "lisinopril 有哪些禁忌或警示？",
  "糖尿病患者看 metformin 说明书需要注意什么？",
] as const;

const MEDICATION_SEEKING_QUERIES = [
  "男 25 感冒 中成药",
  "25岁男 感冒吃什么中成药",
  "风寒感冒吃点什么中药",
  "感冒可以吃哪些中成药",
  "咳嗽可以吃什么药",
  "胃痛吃什么药",
  "腹痛相关处方有哪些",
  "中暑怎么处理",
  "女 30 发烧 西药",
  "儿童发烧可以看哪些退烧药说明",
] as const;

const ALL_TEST_QUERIES = [...TEST_QUERIES, ...MEDICATION_SEEKING_QUERIES] as const;
const MEDICATION_QUERY_SET = new Set<string>(MEDICATION_SEEKING_QUERIES);

async function main() {
  const env = getScriptEnv();
  const db = createAdminClient();

  try {
    const results = [];

    for (const query of ALL_TEST_QUERIES) {
      const evidencePackage = await hybridSearch({
        db,
        query,
        vectorConfig: {
          apiKey: env.GEMINI_API_KEY,
          embeddingModel: env.GEMINI_EMBEDDING_MODEL,
          embeddingDimension: env.GEMINI_EMBEDDING_DIMENSION,
        },
      });
      const medicalBookEvidenceCount = evidencePackage.selected_evidence.filter(
        (item) => item.source_type === "medical_book",
      ).length;
      const drugLabelEvidenceCount = evidencePackage.selected_evidence.filter((item) =>
        ["drug_label", "drug_label_candidate"].includes(item.source_type),
      ).length;

      if (
        MEDICATION_QUERY_SET.has(query) &&
        !query.includes("西药") &&
        medicalBookEvidenceCount === 0
      ) {
        throw new Error(`中文找药问题没有命中 medical_book 来源：${query}`);
      }

      results.push({
        query,
        book_intent: evidencePackage.normalized_query.book_intent,
        medication_preference: evidencePackage.normalized_query.medication_preference,
        question_type: evidencePackage.normalized_query.question_type,
        detected_symptoms: evidencePackage.normalized_query.detected_symptoms,
        expanded_terms: evidencePackage.normalized_query.expanded_terms,
        keyword_result_count: evidencePackage.keyword_result_count,
        vector_result_count: evidencePackage.vector_result_count,
        selected_evidence_count: evidencePackage.selected_evidence.length,
        medical_book_evidence_count: medicalBookEvidenceCount,
        drug_label_evidence_count: drugLabelEvidenceCount,
        has_medical_book: medicalBookEvidenceCount > 0,
        top_evidence: evidencePackage.selected_evidence.slice(0, 4).map((item) => ({
          chunk_id: item.chunk_id,
          source_id: item.source_id,
          source_type: item.source_type,
          book_title: item.book_title,
          section_name: item.section_name,
          document_title: item.document_title,
          score: item.score,
          why_selected: item.why_selected,
        })),
        insufficient_evidence: evidencePackage.insufficient_evidence,
      });
    }

    console.log(JSON.stringify(results, null, 2));
  } finally {
    await closeAdminClient(db);
  }
}

main().catch((error) => {
  if (error instanceof Error) {
    console.error(`检索测试失败：${error.message}`);
  } else {
    console.error("检索测试失败。");
  }

  process.exit(1);
});
