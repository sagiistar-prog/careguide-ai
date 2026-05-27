import { NextResponse } from "next/server";
import { safeErrorResponse, safeRouteError } from "../../../lib/api/errors";
import { closeServerDb, createServerDb } from "../../../lib/db/postgres";

export const runtime = "nodejs";

const SCENARIOS = [
  {
    key: "cold_fever",
    title: "感冒发热",
    description: "围绕感冒、发热和常见退热药说明书的本地资料。",
    example_questions: [
      "男 25 感冒 中成药",
      "感冒可以吃哪些中成药？",
      "儿童发烧可以看哪些退烧药说明？",
    ],
  },
  {
    key: "children_fever",
    title: "儿童退烧",
    description: "聚焦儿童发热相关药品标签中的儿童、剂量和警示章节。",
    example_questions: [
      "ibuprofen 对儿童有什么警示？",
      "儿童发烧可以看哪些退烧药说明？",
    ],
  },
  {
    key: "hypertension",
    title: "高血压",
    description: "聚焦高血压相关药品标签中的适应症、警示和禁忌。",
    example_questions: [
      "高血压患者看 amlodipine 说明书需要注意什么？",
      "lisinopril 有哪些禁忌或警示？",
    ],
  },
  {
    key: "diabetes",
    title: "糖尿病",
    description: "聚焦糖尿病相关药品标签中的警示和不良反应。",
    example_questions: [
      "metformin 有哪些不良反应？",
      "糖尿病患者看 metformin 说明书需要注意什么？",
    ],
  },
] as const;

export async function GET() {
  const db = createServerDb();

  try {
    const rows = await db<{ key: string; coverage_count: string | number }[]>`
      select
        me.canonical_name as key,
        count(distinct ss.source_document_id) as coverage_count
      from public.medical_entities me
      left join public.scenario_sources ss on ss.scenario_entity_id = me.id
      where me.entity_type = 'scenario'
      group by me.canonical_name
    `;
    const coverage = new Map(
      rows.map((row) => [row.key, Number(row.coverage_count)]),
    );

    return NextResponse.json({
      scenarios: SCENARIOS.map((scenario) => ({
        ...scenario,
        coverage_count: coverage.get(scenario.key) ?? 0,
      })),
    });
  } catch (error) {
    return safeErrorResponse({
      status: 500,
      code: "INTERNAL_ERROR",
      message: safeRouteError(error),
    });
  } finally {
    await closeServerDb(db);
  }
}
