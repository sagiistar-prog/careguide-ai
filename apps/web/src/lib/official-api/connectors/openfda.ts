import { getServerEnv } from "../../env";
import { requestOfficialJson } from "../client";
import type { OfficialApiRequest, QueryParams } from "../types";

type OpenFdaEndpoint = "drug/label.json" | "drug/ndc.json" | "drug/enforcement.json";

function isOpenFdaEmpty(data: unknown) {
  return (
    typeof data === "object" &&
    data !== null &&
    "results" in data &&
    Array.isArray((data as { results?: unknown }).results) &&
    (data as { results: unknown[] }).results.length === 0
  );
}

export function createOpenFdaConnector() {
  const env = getServerEnv();

  function request<T>(
    endpoint: OpenFdaEndpoint,
    query: QueryParams = {},
    options: Partial<OfficialApiRequest> = {},
  ) {
    return requestOfficialJson<T>({
      source: "openfda",
      baseUrl: env.OPENFDA_BASE_URL,
      path: endpoint,
      query: {
        ...query,
        api_key: env.OPENFDA_API_KEY,
      },
      rateLimit: {
        key: "openfda",
        minIntervalMs: 250,
      },
      emptyWhen: isOpenFdaEmpty,
      ...options,
    });
  }

  return {
    drugLabel<T>(query: QueryParams, options?: Partial<OfficialApiRequest>) {
      return request<T>("drug/label.json", query, options);
    },
    ndcDirectory<T>(query: QueryParams, options?: Partial<OfficialApiRequest>) {
      return request<T>("drug/ndc.json", query, options);
    },
    drugEnforcement<T>(
      query: QueryParams,
      options?: Partial<OfficialApiRequest>,
    ) {
      return request<T>("drug/enforcement.json", query, options);
    },
  };
}
