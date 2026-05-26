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

const BOOK_TEST_QUERIES = [
  "腹痛怎么办？",
  "中暑了怎么办？",
  "风寒感冒吃点什么中药？",
  "感冒可以吃哪些中成药？",
  "腹痛相关处方有哪些？",
  "肚子痛怎么办？",
  "中暑怎么处理？",
  "风寒感冒怎么调养？",
  "胃痛吃什么药？",
  "咳嗽怎么改善？",
  "腹泻怎么办？",
  "失眠吃什么中药？",
  "头痛怎么办？",
] as const;

const ALL_TEST_QUERIES = [...TEST_QUERIES, ...BOOK_TEST_QUERIES] as const;
const BOOK_QUERY_SET = new Set<string>(BOOK_TEST_QUERIES);

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

      if (BOOK_QUERY_SET.has(query) && medicalBookEvidenceCount === 0) {
        throw new Error(`中文书籍问题没有命中 medical_book 来源：${query}`);
      }

      results.push({
        query,
        detected_entities: {
          drugs: evidencePackage.detected_entities.drugs.map(
            (entity) => entity.canonical_name,
          ),
          scenarios: evidencePackage.detected_entities.scenarios.map(
            (entity) => entity.canonical_name,
          ),
          population: evidencePackage.detected_entities.population,
          risk_terms: evidencePackage.normalized_query.risk_terms,
        },
        book_intent: evidencePackage.normalized_query.book_intent,
        expanded_terms: evidencePackage.normalized_query.expanded_terms,
        keyword_result_count: evidencePackage.keyword_result_count,
        vector_result_count: evidencePackage.vector_result_count,
        selected_evidence_count: evidencePackage.selected_evidence.length,
        medical_book_evidence_count: medicalBookEvidenceCount,
        has_medical_book: medicalBookEvidenceCount > 0,
        top_evidence: evidencePackage.selected_evidence.slice(0, 3).map((item) => ({
          chunk_id: item.chunk_id,
          source_id: item.source_id,
          source_type: item.source_type,
          book_title: item.book_title,
          section_name: item.section_name,
          document_title: item.document_title,
          score: item.score,
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
