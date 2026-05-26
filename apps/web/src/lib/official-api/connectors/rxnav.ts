import { getServerEnv } from "../../env";
import { requestOfficialJson } from "../client";
import type { OfficialApiRequest, QueryParams } from "../types";

function isRxNavEmpty(data: unknown) {
  if (data == null) {
    return true;
  }

  if (typeof data === "object" && Object.keys(data).length === 0) {
    return true;
  }

  return false;
}

export function createRxNavConnector() {
  const env = getServerEnv();

  return {
    get<T>(
      path: string,
      query: QueryParams = {},
      options: Partial<OfficialApiRequest> = {},
    ) {
      return requestOfficialJson<T>({
        source: "rxnav",
        baseUrl: env.RXNAV_BASE_URL,
        path,
        query,
        rateLimit: {
          key: "rxnav",
          minIntervalMs: 250,
        },
        emptyWhen: isRxNavEmpty,
        ...options,
      });
    },
  };
}
