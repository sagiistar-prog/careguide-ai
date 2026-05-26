export const ALLOWED_SCENARIOS = [
  "cold_fever",
  "children_fever",
  "hypertension",
  "diabetes",
] as const;

export type AllowedScenario = (typeof ALLOWED_SCENARIOS)[number];

export type QueryRequestBody = {
  query: string;
  scenario?: AllowedScenario;
  locale: "zh-CN";
};

export type ValidationResult =
  | { ok: true; data: QueryRequestBody }
  | { ok: false; message: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function validateQueryBody(body: unknown): ValidationResult {
  if (!isRecord(body)) {
    return { ok: false, message: "Request body must be a JSON object." };
  }

  if (typeof body.query !== "string") {
    return { ok: false, message: "query must be a string." };
  }

  const query = body.query.trim();

  if (query.length < 2) {
    return { ok: false, message: "query must be at least 2 characters." };
  }

  if (query.length > 500) {
    return { ok: false, message: "query must be 500 characters or fewer." };
  }

  if (body.scenario != null) {
    if (
      typeof body.scenario !== "string" ||
      !ALLOWED_SCENARIOS.includes(body.scenario as AllowedScenario)
    ) {
      return { ok: false, message: "scenario is not supported." };
    }
  }

  const locale = body.locale ?? "zh-CN";

  if (locale !== "zh-CN") {
    return { ok: false, message: "locale is not supported." };
  }

  return {
    ok: true,
    data: {
      query,
      scenario: body.scenario as AllowedScenario | undefined,
      locale,
    },
  };
}
