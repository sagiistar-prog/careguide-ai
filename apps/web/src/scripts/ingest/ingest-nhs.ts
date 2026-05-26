import { createNhsConnector } from "../../lib/official-api/connectors/nhs";
import type { AdminClient } from "./lib/db";
import {
  linkScenarioSourcesForDocument,
  persistDocument,
  recordRawSource,
  type ImportRunCounters,
} from "./lib/persist";
import { NHS_CONTENT_PATHS } from "./lib/ingest-constants";
import { extractNhsDocument } from "./lib/extract";

export async function ingestNhs(
  db: AdminClient,
  importRunId: string,
  counters: ImportRunCounters,
) {
  const nhs = createNhsConnector();

  for (const contentPath of NHS_CONTENT_PATHS) {
    const result = await nhs.get<unknown>(contentPath.path, {}, {
      timeoutMs: 10_000,
      retry: {
        retries: 0,
        initialDelayMs: 500,
        maxDelayMs: 1_000,
      },
    });

    if (!result.ok) {
      counters.failureCount += 1;
      counters.errors.push({
        source: "nhs_website_content",
        message: `${contentPath.path}: ${result.error.message}`,
      });
      await recordRawSource(db, {
        connectorSlug: "nhs_website_content",
        importRunId,
        externalId: contentPath.path,
        error: result.error,
        metadata: { path: contentPath.path },
      });
      continue;
    }

    const rawSourceRecordId = await recordRawSource(db, {
      connectorSlug: "nhs_website_content",
      importRunId,
      externalId: contentPath.path,
      requestUrl: result.meta.sanitizedUrl,
      statusCode: result.status,
      payloadJson: result.data,
      empty: result.empty,
      metadata: { path: contentPath.path },
    });

    if (result.empty || result.data == null) {
      counters.emptyCount += 1;
      continue;
    }

    const document = extractNhsDocument({
      payload: result.data,
      rawSourceRecordId,
      path: contentPath.path,
      scenarioTags: [...contentPath.scenarioTags],
    });

    if (!document) {
      counters.emptyCount += 1;
      continue;
    }

    const documentId = await persistDocument(db, document);
    if (documentId) {
      await linkScenarioSourcesForDocument(
        db,
        documentId,
        contentPath.scenarioTags,
      );
      counters.successCount += 1;
    }
  }
}
