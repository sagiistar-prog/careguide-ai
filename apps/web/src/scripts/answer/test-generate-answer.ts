import { generateStructuredAnswer } from "../../lib/answer/generate-structured-answer";
import { persistAnswerAudit } from "../../lib/answer/answer-persister";
import { safeAnswerResponse } from "../../lib/api/safe-response";
import { hybridSearch } from "../../lib/retrieval/hybrid-search";
import { buildMedicationDisplay } from "../../components/workbench/display-adapter";
import type { QueryResponse } from "../../components/workbench/types";
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
  "25岁男 感冒吃什么中成药",
  "风寒感冒吃点什么中药？",
  "感冒可以吃哪些药",
  "感冒可以吃哪些中成药？",
  "头痛怎么办",
  "头疼吃什么药",
  "腹痛相关处方有哪些？",
  "痛经怎么办",
  "女 30 发烧 西药",
] as const;

const POLLUTION_PATTERN =
  /蛇咬伤|咬伤|伤口|创口|服毒|催吐|洗胃|导泻|中毒|静脉滴注|肌内注射|该卡片|source_id|chunk_id|】/;

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

function assertCleanMedicationDisplay(result: QueryResponse) {
  const display = buildMedicationDisplay(result);
  const groups = [...display.western, ...display.tcm];

  for (const group of groups) {
    const visibleText = [
      group.name,
      ...Object.values(group.fields),
      ...group.externalNotes,
    ].join("\n");

    assert(
      !POLLUTION_PATTERN.test(visibleText),
      `药品卡可见内容出现污染文本：${result.query} / ${group.name}`,
    );

    assert(group.name !== "该卡片", `出现假药名“该卡片”：${result.query}`);
  }

  if (/痛经|经痛/.test(result.query)) {
    assert(display.western.length > 0, `痛经查询没有展示西药卡：${result.query}`);
    assert(
      display.western.some((group) =>
        Object.values(group.fields).some((field) => field !== "本地资料未列出"),
      ),
      `痛经查询西药卡字段全部为空：${result.query}`,
    );
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
      assertCleanMedicationDisplay(
        safeAnswerResponse({
          requestId: "script",
          evidencePackage,
          validation,
        }) as QueryResponse,
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
