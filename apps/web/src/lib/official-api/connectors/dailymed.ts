import { getServerEnv } from "../../env";
import { requestOfficialJson } from "../client";
import type { OfficialApiRequest, QueryParams } from "../types";

function isDailyMedEmpty(data: unknown) {
  return (
    typeof data === "object" &&
    data !== null &&
    "data" in data &&
    Array.isArray((data as { data?: unknown }).data) &&
    (data as { data: unknown[] }).data.length === 0
  );
}

export function createDailyMedConnector() {
  const env = getServerEnv();

  return {
    get<T>(
      path: string,
      query: QueryParams = {},
      options: Partial<OfficialApiRequest> = {},
    ) {
      return requestOfficialJson<T>({
        source: "dailymed",
        baseUrl: env.DAILYMED_BASE_URL,
        path,
        query,
        rateLimit: {
          key: "dailymed",
          minIntervalMs: 500,
        },
        emptyWhen: isDailyMedEmpty,
        ...options,
      });
    },
  };
}
