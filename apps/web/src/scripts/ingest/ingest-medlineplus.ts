import { createMedlinePlusConnector } from "../../lib/official-api/connectors/medlineplus";
import type { AdminClient } from "./lib/db";
import {
  linkScenarioSourcesForDocument,
  persistDocument,
  recordRawSource,
  type ImportRunCounters,
} from "./lib/persist";
import { MVP_MEDICINES } from "./lib/ingest-constants";
import { extractMedlinePlusDocument } from "./lib/extract";

export async function ingestMedlinePlus(
  db: AdminClient,
  importRunId: string,
  counters: ImportRunCounters,
  rxcuiByMedicine: Map<string, string>,
) {
  const medlineplus = createMedlinePlusConnector();

  const probeMedicines = MVP_MEDICINES.slice(0, 2);

  for (const medicine of probeMedicines) {
    const rxcui = rxcuiByMedicine.get(medicine.name);

    if (!rxcui) {
      counters.emptyCount += 1;
      await recordRawSource(db, {
        connectorSlug: "medlineplus_connect",
        importRunId,
        externalId: medicine.name,
        empty: true,
        metadata: {
          medicine: medicine.name,
          reason: "missing_rxcui",
        },
      });
      continue;
    }

    const result = await medlineplus.get<unknown>({
      "mainSearchCriteria.v.cs": "2.16.840.1.113883.6.88",
      "mainSearchCriteria.v.c": rxcui,
      "mainSearchCriteria.v.dn": medicine.name,
    }, {
      timeoutMs: 5_000,
      retry: {
        retries: 0,
        initialDelayMs: 500,
        maxDelayMs: 1_000,
      },
    });

    if (!result.ok) {
      counters.failureCount += 1;
      counters.errors.push({
        source: "medlineplus_connect",
        message: `${medicine.name}: ${result.error.message}`,
      });
      await recordRawSource(db, {
        connectorSlug: "medlineplus_connect",
        importRunId,
        externalId: rxcui,
        error: result.error,
        metadata: { medicine: medicine.name },
      });
      continue;
    }

    const rawSourceRecordId = await recordRawSource(db, {
      connectorSlug: "medlineplus_connect",
      importRunId,
      externalId: rxcui,
      requestUrl: result.meta.sanitizedUrl,
      statusCode: result.status,
      payloadJson: result.data,
      empty: result.empty,
      metadata: { medicine: medicine.name, rxcui },
    });

    if (result.empty || result.data == null) {
      counters.emptyCount += 1;
      continue;
    }

    const document = extractMedlinePlusDocument({
      payload: result.data,
      rawSourceRecordId,
      medicineName: medicine.name,
      rxcui,
      scenarioTags: [...medicine.scenarioTags],
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
        medicine.scenarioTags,
        [medicine.name],
      );
      counters.successCount += 1;
    }
  }

  for (const medicine of MVP_MEDICINES.slice(probeMedicines.length)) {
    counters.emptyCount += 1;
    await recordRawSource(db, {
      connectorSlug: "medlineplus_connect",
      importRunId,
      externalId: medicine.name,
      empty: true,
      metadata: {
        medicine: medicine.name,
        reason: "minimal_stage_probe_limit",
      },
    });
  }
}
