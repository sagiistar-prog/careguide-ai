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
  "男 25 感冒 中成药",
  "风寒感冒吃点什么中药？",
  "感冒可以吃哪些中成药？",
  "腹痛相关处方有哪些？",
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
