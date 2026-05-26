import { getServerEnv } from "../../env";
import { requestOfficialJson } from "../client";
import type { OfficialApiRequest, QueryParams } from "../types";

function isMedlinePlusEmpty(data: unknown) {
  return data == null;
}

export function createMedlinePlusConnector() {
  const env = getServerEnv();

  return {
    get<T>(
      query: QueryParams = {},
      options: Partial<OfficialApiRequest> = {},
    ) {
      return requestOfficialJson<T>({
        source: "medlineplus",
        baseUrl: env.MEDLINEPLUS_CONNECT_BASE_URL,
        path: "",
        query: {
          mainSearchCriteria: "true",
          knowledgeResponseType: "application/json",
          ...query,
        },
        rateLimit: {
          key: "medlineplus",
          minIntervalMs: 650,
        },
        emptyWhen: isMedlinePlusEmpty,
        ...options,
      });
    },
  };
}
