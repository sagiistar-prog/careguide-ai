import { generateStructuredAnswer } from "../../lib/answer/generate-structured-answer";
import { persistAnswerAudit } from "../../lib/answer/answer-persister";
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
  "我现在胸痛还呼吸困难，可以吃布洛芬吗？",
  "\u8179\u75db\u600e\u4e48\u529e\uff1f",
  "\u4e2d\u6691\u4e86\u600e\u4e48\u529e\uff1f",
  "\u98ce\u5bd2\u611f\u5192\u5403\u70b9\u4ec0\u4e48\u4e2d\u836f\uff1f",
  "\u611f\u5192\u53ef\u4ee5\u5403\u54ea\u4e9b\u4e2d\u6210\u836f\uff1f",
  "\u8179\u75db\u76f8\u5173\u5904\u65b9\u6709\u54ea\u4e9b\uff1f",
] as const;

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

async function main() {
  const env = getScriptEnv();
  const db = createAdminClient();

  try {
    const summaries = [];

    for (const query of TEST_QUERIES) {
      const evidencePackage = await hybridSearch({
        db,
        query,
        vectorConfig: {
          apiKey: env.GEMINI_API_KEY,
          embeddingModel: env.GEMINI_EMBEDDING_MODEL,
          embeddingDimension: env.GEMINI_EMBEDDING_DIMENSION,
        },
      });
      const { answer, validation } = await generateStructuredAnswer({
        evidencePackage,
        geminiApiKey: env.GEMINI_API_KEY,
        geminiModel: env.GEMINI_MODEL,
      });

      await persistAnswerAudit({
        db,
        evidencePackageId: evidencePackage.evidence_package_id,
        answer,
        validation,
      });

      assert(
        validation.citation_coverage === 1,
        `Citation coverage below 100% for query: ${query}`,
      );

      summaries.push({
        query,
        answer_status: answer.answer_status,
        sentence_count:
          answer.plain_language_summary.length +
          answer.safety_notices.length +
          answer.questions_for_doctor_or_pharmacist.length +
          answer.limitations.length,
        citation_coverage: validation.citation_coverage,
        evidence_card_count: answer.evidence_cards.length,
        safety_notice_count: answer.safety_notices.length,
        rejected_claim_count: answer.rejected_claims.length,
        citation_validation_passed: validation.valid,
      });
    }

    console.log(JSON.stringify(summaries, null, 2));
  } finally {
    await closeAdminClient(db);
  }
}

main().catch((error) => {
  if (error instanceof Error) {
    console.error(`Answer test failed: ${error.message}`);
  } else {
    console.error("Answer test failed.");
  }

  process.exit(1);
});
