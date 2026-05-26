import { getServerEnv } from "../../env";
import { requestOfficialJson } from "../client";
import type { OfficialApiRequest, QueryParams } from "../types";

function isNhsEmpty(data: unknown) {
  if (Array.isArray(data)) {
    return data.length === 0;
  }

  return data == null;
}

export function createNhsConnector() {
  const env = getServerEnv();

  return {
    get<T>(
      path: string,
      query: QueryParams = {},
      options: Partial<OfficialApiRequest> = {},
    ) {
      return requestOfficialJson<T>({
        source: "nhs",
        baseUrl: env.NHS_WEBSITE_CONTENT_BASE_URL,
        path,
        query,
        headers: {
          "subscription-key": env.NHS_WEBSITE_CONTENT_API_KEY,
          Accept: "application/json",
        },
        rateLimit: {
          key: "nhs",
          minIntervalMs: 500,
        },
        emptyWhen: isNhsEmpty,
        ...options,
      });
    },
  };
}
