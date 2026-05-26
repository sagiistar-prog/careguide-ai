import { createDailyMedConnector } from "../../lib/official-api/connectors/dailymed";
import type { AdminClient } from "./lib/db";
import {
  linkScenarioSourcesForDocument,
  persistDocument,
  recordRawSource,
  type ImportRunCounters,
} from "./lib/persist";
import { MVP_MEDICINES } from "./lib/ingest-constants";
import { extractDailyMedCandidateDocuments } from "./lib/extract";

export async function ingestDailyMed(
  db: AdminClient,
  importRunId: string,
  counters: ImportRunCounters,
) {
  const dailymed = createDailyMedConnector();

  for (const medicine of MVP_MEDICINES) {
    const result = await dailymed.get<unknown>("spls.json", {
      drug_name: medicine.name,
      pagesize: 2,
    });

    if (!result.ok) {
      counters.failureCount += 1;
      counters.errors.push({
        source: "dailymed",
        message: `${medicine.name}: ${result.error.message}`,
      });
      await recordRawSource(db, {
        connectorSlug: "dailymed",
        importRunId,
        externalId: medicine.name,
        error: result.error,
        metadata: { medicine: medicine.name },
      });
      continue;
    }

    const rawSourceRecordId = await recordRawSource(db, {
      connectorSlug: "dailymed",
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

    const documents = extractDailyMedCandidateDocuments({
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

