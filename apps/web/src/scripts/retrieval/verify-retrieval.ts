import { hybridSearch } from "../../lib/retrieval/hybrid-search";
import { closeAdminClient, createAdminClient } from "../ingest/lib/db";
import { getScriptEnv } from "../ingest/lib/script-env";

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

function countValue(rows: Array<{ count: string | number }>) {
  return Number(rows[0]?.count ?? 0);
}

async function main() {
  const env = getScriptEnv();
  const db = createAdminClient();

  try {
    const sourceChunks = countValue(
      await db`select count(*) from public.source_chunks`,
    );
    const chunkEmbeddings = countValue(
      await db`
        select count(*)
        from public.chunk_embeddings
        where embedding_model = ${env.GEMINI_EMBEDDING_MODEL}
          and dimension = ${env.GEMINI_EMBEDDING_DIMENSION}
      `,
    );

    assert(sourceChunks > 0, "source_chunks 缺失。");
    assert(
      chunkEmbeddings > 0,
      "当前模型和维度下没有 chunk_embeddings。",
    );

    const officialPackage = await hybridSearch({
      db,
      query: "acetaminophen 有哪些 warnings？",
      vectorConfig: {
        apiKey: env.GEMINI_API_KEY,
        embeddingModel: env.GEMINI_EMBEDDING_MODEL,
        embeddingDimension: env.GEMINI_EMBEDDING_DIMENSION,
      },
    });

    assert(
      officialPackage.selected_evidence.length > 0,
      "英文药品说明书问题没有返回 selected evidence。",
    );

    for (const evidence of officialPackage.selected_evidence) {
      assert(Boolean(evidence.source_id), "selected evidence 缺少 source_id。");
      assert(Boolean(evidence.chunk_id), "selected evidence 缺少 chunk_id。");
      assert(
        Boolean(evidence.source_document_id),
        "selected evidence 缺少 source_document_id。",
      );
      assert(
        Boolean(evidence.source_organization),
        "selected evidence 缺少 source_organization。",
      );
      assert(
        Boolean(evidence.published_at || evidence.source_updated_at),
        "selected evidence 缺少来源日期。",
      );
    }

    const officialTopSourceType = officialPackage.selected_evidence[0]?.source_type;

    assert(
      ["drug_label", "drug_label_candidate"].includes(officialTopSourceType ?? ""),
      "英文药品说明书问题没有优先命中 openFDA 或 DailyMed 药品标签来源。",
    );

    const insufficientPackage = await hybridSearch({
      db,
      query: "火星药物 xyznotindatabase 有哪些说明？",
      vectorConfig: {
        apiKey: env.GEMINI_API_KEY,
        embeddingModel: env.GEMINI_EMBEDDING_MODEL,
        embeddingDimension: env.GEMINI_EMBEDDING_DIMENSION,
      },
    });

    assert(
      insufficientPackage.insufficient_evidence,
      "未知问题应该返回 insufficient_evidence=true。",
    );
    assert(
      insufficientPackage.selected_evidence.length === 0,
      "未知问题不应返回 selected evidence。",
    );

    const bookQueries = [
      "腹痛相关处方有哪些？",
      "肚子痛怎么办？",
      "中暑怎么处理？",
      "风寒感冒怎么调养？",
      "胃痛吃什么药？",
      "咳嗽怎么改善？",
      "腹泻怎么办？",
      "失眠吃什么中药？",
      "头痛怎么办？",
    ];
    const bookSummaries = [];

    for (const query of bookQueries) {
      const bookPackage = await hybridSearch({
        db,
        query,
        vectorConfig: {
          apiKey: env.GEMINI_API_KEY,
          embeddingModel: env.GEMINI_EMBEDDING_MODEL,
          embeddingDimension: env.GEMINI_EMBEDDING_DIMENSION,
        },
      });
      const bookEvidence = bookPackage.selected_evidence.filter(
        (evidence) => evidence.source_type === "medical_book",
      );

      assert(bookPackage.normalized_query.book_intent, `没有识别出 book_intent：${query}`);
      assert(bookEvidence.length > 0, `中文书籍问题没有命中 medical_book：${query}`);

      for (const evidence of bookEvidence) {
        assert(Boolean(evidence.source_id), "medical_book 证据缺少 source_id。");
        assert(Boolean(evidence.chunk_id), "medical_book 证据缺少 chunk_id。");
        assert(
          Boolean(evidence.source_document_id),
          "medical_book 证据缺少 source_document_id。",
        );
        assert(Boolean(evidence.book_title), "medical_book 证据缺少 book_title。");
        assert(
          Boolean(evidence.location || evidence.page_start),
          "medical_book 证据缺少 location 或 page。",
        );
      }

      bookSummaries.push({
        query,
        selected_evidence_count: bookPackage.selected_evidence.length,
        medical_book_evidence_count: bookEvidence.length,
      });
    }

    console.log(
      JSON.stringify(
        {
          status: "通过",
          source_chunks: sourceChunks,
          chunk_embeddings: chunkEmbeddings,
          official_query_top_source_type: officialTopSourceType,
          insufficient_query_status: insufficientPackage.insufficient_evidence,
          insufficient_query_evidence_count:
            insufficientPackage.selected_evidence.length,
          book_queries: bookSummaries,
        },
        null,
        2,
      ),
    );
  } finally {
    await closeAdminClient(db);
  }
}

main().catch((error) => {
  if (error instanceof Error) {
    console.error(`检索验证失败：${error.message}`);
  } else {
    console.error("检索验证失败。");
  }

  process.exit(1);
});
