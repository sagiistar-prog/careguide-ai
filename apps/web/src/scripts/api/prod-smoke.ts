type JsonObject = Record<string, unknown>;
type ApiResult = { ok: boolean; status: number; payload: JsonObject };

const QUERIES = [
  "男 25 感冒 中成药",
  "儿童发烧可以看哪些退烧药说明？",
  "我现在胸痛还呼吸困难，可以吃布洛芬吗？",
] as const;

function baseUrl() {
  const value = process.env.CAREGUIDE_BASE_URL?.trim();

  if (!value) {
    return null;
  }

  return value.replace(/\/+$/, "");
}

function medicationCardCount(payload: JsonObject) {
  const cards = Array.isArray(payload.evidence_cards) ? payload.evidence_cards : [];

  return cards.filter((card) => {
    if (typeof card !== "object" || card === null) {
      return false;
    }

    const record = card as JsonObject;
    return (
      typeof record.card_type === "string" &&
      record.card_type !== "patient_education" &&
      record.card_type !== "insufficient_evidence"
    );
  }).length;
}

async function readJson(response: Response) {
  try {
    return (await response.json()) as JsonObject;
  } catch {
    return {};
  }
}

async function getJson(url: string) {
  const response = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
  });

  return {
    ok: response.ok,
    status: response.status,
    payload: await readJson(response),
  };
}

async function postQuery(url: string, query: string) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query,
      locale: "zh-CN",
    }),
  });

  return {
    ok: response.ok,
    status: response.status,
    payload: await readJson(response),
  };
}

function logResult(label: string, result: ApiResult) {
  console.log(
    JSON.stringify({
      check: label,
      http_status: result.status,
      ok: result.ok,
      api_status: result.payload.status,
      error_type: result.ok ? undefined : "api_request_failed",
    }),
  );
}

async function main() {
  const root = baseUrl();

  if (!root) {
    console.log("prod:smoke skipped: CAREGUIDE_BASE_URL is not set.");
    return;
  }

  const health = await getJson(`${root}/api/health`);
  logResult("GET /api/health", health);

  const scenarios = await getJson(`${root}/api/scenarios`);
  logResult("GET /api/scenarios", scenarios);

  const coverage = await getJson(`${root}/api/kb/coverage`);
  logResult("GET /api/kb/coverage", coverage);

  const queryResults: ApiResult[] = [];

  for (const query of QUERIES) {
    const result = await postQuery(`${root}/api/query`, query);
    queryResults.push(result);

    console.log(
      JSON.stringify({
        check: "POST /api/query",
        query,
        http_status: result.status,
        ok: result.ok,
        answer_status: result.payload.answer_status,
        citation_coverage: result.payload.citation_coverage,
        medication_cards: medicationCardCount(result.payload) > 0,
        error_type: result.ok ? undefined : "api_request_failed",
      }),
    );
  }

  const failed =
    !health.ok ||
    !scenarios.ok ||
    !coverage.ok ||
    queryResults.some((result) => !result.ok);

  if (failed) {
    throw new Error("prod_smoke_failed");
  }
}

main().catch((error) => {
  console.error(
    JSON.stringify({
      status: "failed",
      error_type: error instanceof Error ? error.message : "unknown_error",
    }),
  );
  process.exit(1);
});
