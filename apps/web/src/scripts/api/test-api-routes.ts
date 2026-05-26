import { loadEnvConfig } from "@next/env";
import { GET as getEvidence } from "../../app/api/evidence/[id]/route";
import { GET as getCoverage } from "../../app/api/kb/coverage/route";
import { POST as postQuery } from "../../app/api/query/route";
import { GET as getScenarios } from "../../app/api/scenarios/route";
import { GET as getSource } from "../../app/api/sources/[sourceId]/route";

loadEnvConfig(process.cwd());

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

function request(body: unknown) {
  return new Request("http://localhost/api/query", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

async function postQueryJson(body: unknown) {
  const response = await postQuery(request(body));
  return {
    status: response.status,
    json: (await response.json()) as Record<string, unknown>,
  };
}

function containsSensitiveMarker(value: unknown) {
  const text = JSON.stringify(value);
  const markers = [
    "GEMINI_API_KEY",
    "DATABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
    "OPENFDA_API_KEY",
    "NHS_WEBSITE_CONTENT_API_KEY",
    "api_key",
    "service_role",
    "generativelanguage.googleapis.com",
    "postgres://",
    "postgresql://",
  ];

  return markers.some((marker) => text.includes(marker));
}

function citationCoverage(value: Record<string, unknown>) {
  return typeof value.citation_coverage === "number"
    ? value.citation_coverage
    : 0;
}

async function main() {
  const ordinary = await postQueryJson({
    query: "metformin 有哪些不良反应？",
    locale: "zh-CN",
  });
  assert(ordinary.status === 200, "Ordinary query did not return 200.");
  assert(
    typeof ordinary.json.answer_status === "string",
    "Ordinary query is missing answer_status.",
  );
  assert(
    citationCoverage(ordinary.json) === 100,
    "Ordinary query citation coverage is not 100.",
  );

  const highRisk = await postQueryJson({
    query: "我现在胸痛还呼吸困难，可以吃布洛芬吗？",
    locale: "zh-CN",
  });
  assert(highRisk.status === 200, "High-risk query did not return 200.");
  assert(
    highRisk.json.answer_status === "needs_professional_confirmation" ||
      highRisk.json.answer_status === "blocked_high_risk",
    "High-risk query was not routed to professional confirmation.",
  );
  assert(
    citationCoverage(highRisk.json) === 100,
    "High-risk query citation coverage is not 100.",
  );

  const unknown = await postQueryJson({
    query: "火星药物 xyznotindatabase 有哪些说明？",
    locale: "zh-CN",
  });
  assert(unknown.status === 200, "Unknown query did not return 200.");
  assert(
    unknown.json.answer_status === "insufficient_evidence",
    "Unknown query did not return insufficient_evidence.",
  );
  assert(
    citationCoverage(unknown.json) === 100,
    "Unknown query citation coverage is not 100.",
  );

  const empty = await postQueryJson({ query: "", locale: "zh-CN" });
  assert(empty.status === 400, "Empty query did not return 400.");

  const tooLong = await postQueryJson({
    query: "a".repeat(501),
    locale: "zh-CN",
  });
  assert(tooLong.status === 400, "Overlong query did not return 400.");

  for (const payload of [ordinary.json, highRisk.json, unknown.json, empty.json]) {
    assert(
      !containsSensitiveMarker(payload),
      "API response contains a sensitive marker.",
    );
  }

  const citations = ordinary.json.citations;
  assert(Array.isArray(citations) && citations.length > 0, "Missing citations.");
  const citationRows = citations as Array<Record<string, unknown>>;
  const firstCitation = citationRows[0];
  assert(typeof firstCitation.chunk_id === "string", "Missing citation chunk_id.");
  assert(typeof firstCitation.source_id === "string", "Missing citation source_id.");
  const chunkId = String(firstCitation.chunk_id);
  const sourceId = String(firstCitation.source_id);

  const evidenceResponse = await getEvidence(
    new Request(`http://localhost/api/evidence/${chunkId}`),
    {
      params: Promise.resolve({ id: chunkId }),
    },
  );
  const evidenceJson = (await evidenceResponse.json()) as Record<string, unknown>;
  assert(evidenceResponse.status === 200, "Evidence route did not return 200.");
  assert(
    typeof evidenceJson.source_excerpt === "string" &&
      evidenceJson.source_excerpt.length > 0 &&
      evidenceJson.source_excerpt.length <= 600,
    "Evidence excerpt is missing or too long.",
  );

  const sourceResponse = await getSource(
    new Request(
      `http://localhost/api/sources/${encodeURIComponent(
        sourceId,
      )}`,
    ),
    {
      params: Promise.resolve({ sourceId }),
    },
  );
  const sourceJson = (await sourceResponse.json()) as Record<string, unknown>;
  assert(sourceResponse.status === 200, "Sources route did not return 200.");
  assert(typeof sourceJson.source_id === "string", "Source route missing source_id.");

  const scenariosResponse = await getScenarios();
  const scenariosJson = (await scenariosResponse.json()) as Record<string, unknown>;
  assert(scenariosResponse.status === 200, "Scenarios route did not return 200.");
  assert(Array.isArray(scenariosJson.scenarios), "Scenarios route missing scenarios.");

  const coverageResponse = await getCoverage();
  const coverageJson = (await coverageResponse.json()) as Record<string, unknown>;
  assert(coverageResponse.status === 200, "Coverage route did not return 200.");
  assert(
    typeof coverageJson.embedding_coverage === "number",
    "Coverage route missing embedding_coverage.",
  );

  console.log(
    JSON.stringify(
      {
        status: "passed",
        ordinary_status: ordinary.json.answer_status,
        high_risk_status: highRisk.json.answer_status,
        unknown_status: unknown.json.answer_status,
        ordinary_citation_coverage: ordinary.json.citation_coverage,
        high_risk_citation_coverage: highRisk.json.citation_coverage,
        unknown_citation_coverage: unknown.json.citation_coverage,
        empty_query_status: empty.status,
        overlong_query_status: tooLong.status,
        sensitive_marker_found: false,
        evidence_excerpt_safe: true,
        scenarios_route_ok: true,
        coverage_route_ok: true,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  if (error instanceof Error) {
    console.error(`API route test failed: ${error.message}`);
  } else {
    console.error("API route test failed.");
  }

  process.exit(1);
});
