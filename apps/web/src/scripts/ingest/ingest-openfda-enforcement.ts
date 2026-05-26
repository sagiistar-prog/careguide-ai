import { createOpenFdaConnector } from "../../lib/official-api/connectors/openfda";
import type { AdminClient } from "./lib/db";
import {
  linkScenarioSourcesForDocument,
  persistDocument,
  recordRawSource,
  type ImportRunCounters,
} from "./lib/persist";
import { MVP_MEDICINES } from "./lib/ingest-constants";
import { extractEnforcementDocuments } from "./lib/extract";

export async function ingestOpenFdaEnforcement(
  db: AdminClient,
  importRunId: string,
  counters: ImportRunCounters,
) {
  const openfda = createOpenFdaConnector();

  for (const medicine of MVP_MEDICINES) {
    const result = await openfda.drugEnforcement<unknown>({
      search: `product_description:"${medicine.name}"`,
      limit: 2,
    });

    if (!result.ok) {
      if (result.status === 404 || result.error.code === "HTTP_404") {
        counters.emptyCount += 1;
        await recordRawSource(db, {
          connectorSlug: "openfda_enforcement",
          importRunId,
          externalId: medicine.name,
          empty: true,
          error: {
            code: "EMPTY_RESULT",
            message: "openFDA returned no matching enforcement records.",
          },
          metadata: { medicine: medicine.name },
        });
        continue;
      }

      counters.failureCount += 1;
      counters.errors.push({
        source: "openfda_enforcement",
        message: `${medicine.name}: ${result.error.message}`,
      });
      await recordRawSource(db, {
        connectorSlug: "openfda_enforcement",
        importRunId,
        externalId: medicine.name,
        error: result.error,
        metadata: { medicine: medicine.name },
      });
      continue;
    }

    const rawSourceRecordId = await recordRawSource(db, {
      connectorSlug: "openfda_enforcement",
      importRunId,
      externalId: medicine.name,
      requestUrl: result.meta.sanitizedUrl,
      statusCode: result.status,
      payloadJson: result.data,
      empty: result.empty,
      metadata: { medicine: medicine.name },
    });

    if (result.empty || result.data == null) {
      counters.emptyCount += 1;
      continue;
    }

    const documents = extractEnforcementDocuments({
      payload: result.data,
      rawSourceRecordId,
      medicineName: medicine.name,
      scenarioTags: [...medicine.scenarioTags],
    });

    for (const document of documents) {
      const documentId = await persistDocument(db, document);
      if (documentId) {
        await linkScenarioSourcesForDocument(
          db,
          documentId,
          medicine.scenarioTags,
          [medicine.name],
        );
      }
    }

    counters.successCount += documents.length;
  }
}
