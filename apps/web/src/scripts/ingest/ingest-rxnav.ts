import { createRxNavConnector } from "../../lib/official-api/connectors/rxnav";
import type { AdminClient } from "./lib/db";
import type { ImportRunCounters } from "./lib/persist";
import { recordRawSource, upsertEntityMapping } from "./lib/persist";
import { MVP_MEDICINES } from "./lib/ingest-constants";

type RxCuiResponse = {
  idGroup?: {
    rxnormId?: string[];
  };
};

function firstRxcui(payload: RxCuiResponse | null) {
  return payload?.idGroup?.rxnormId?.[0];
}

export async function ingestRxNav(
  db: AdminClient,
  importRunId: string,
  counters: ImportRunCounters,
) {
  const rxnav = createRxNavConnector();
  const rxcuiByMedicine = new Map<string, string>();

  for (const medicine of MVP_MEDICINES) {
    const result = await rxnav.get<RxCuiResponse>("rxcui.json", {
      name: medicine.name,
      search: 2,
    });

    if (!result.ok) {
      counters.failureCount += 1;
      counters.errors.push({
        source: "rxnav",
        message: `${medicine.name}: ${result.error.message}`,
      });
      await recordRawSource(db, {
        connectorSlug: "rxnorm",
        importRunId,
        externalId: medicine.name,
        empty: false,
        error: result.error,
        metadata: { medicine: medicine.name },
      });
      continue;
    }

    const rxcui = firstRxcui(result.data);
    await recordRawSource(db, {
      connectorSlug: "rxnorm",
      importRunId,
      externalId: medicine.name,
      requestUrl: result.meta.sanitizedUrl,
      statusCode: result.status,
      payloadJson: result.data,
      empty: result.empty || !rxcui,
      metadata: { medicine: medicine.name },
    });

    if (!rxcui) {
      counters.emptyCount += 1;
      continue;
    }

    rxcuiByMedicine.set(medicine.name, rxcui);
    await upsertEntityMapping(db, {
      entityType: "drug",
      canonicalName: medicine.name,
      mappingType: "rxcui",
      system: "RxNorm",
      code: rxcui,
      value: medicine.name,
      standardName: medicine.name,
      metadata: { aliases: medicine.aliases },
    });

    counters.successCount += 1;

    const rxTermsResult = await rxnav.get<unknown>(
      `RxTerms/rxcui/${rxcui}/allinfo.json`,
    );

    if (!rxTermsResult.ok) {
      counters.failureCount += 1;
      counters.errors.push({
        source: "rxterms",
        message: `${medicine.name}: ${rxTermsResult.error.message}`,
      });
      await recordRawSource(db, {
        connectorSlug: "rxterms",
        importRunId,
        externalId: rxcui,
        error: rxTermsResult.error,
        metadata: { medicine: medicine.name, rxcui },
      });
    } else {
      await recordRawSource(db, {
        connectorSlug: "rxterms",
        importRunId,
        externalId: rxcui,
        requestUrl: rxTermsResult.meta.sanitizedUrl,
        statusCode: rxTermsResult.status,
        payloadJson: rxTermsResult.data,
        empty: rxTermsResult.empty || rxTermsResult.data == null,
        metadata: { medicine: medicine.name, rxcui },
      });

      if (rxTermsResult.empty || rxTermsResult.data == null) {
        counters.emptyCount += 1;
      } else {
        counters.successCount += 1;
        await upsertEntityMapping(db, {
          entityType: "drug",
          canonicalName: medicine.name,
          mappingType: "rxterms",
          system: "RxTerms",
          code: rxcui,
          value: medicine.name,
          standardName: medicine.name,
        });
      }
    }

    const rxClassResult = await rxnav.get<unknown>("rxclass/class/byRxcui.json", {
      rxcui,
    });

    if (!rxClassResult.ok) {
      counters.failureCount += 1;
      counters.errors.push({
        source: "rxclass",
        message: `${medicine.name}: ${rxClassResult.error.message}`,
      });
      await recordRawSource(db, {
        connectorSlug: "rxclass",
        importRunId,
        externalId: rxcui,
        error: rxClassResult.error,
        metadata: { medicine: medicine.name, rxcui },
      });
    } else {
      await recordRawSource(db, {
        connectorSlug: "rxclass",
        importRunId,
        externalId: rxcui,
        requestUrl: rxClassResult.meta.sanitizedUrl,
        statusCode: rxClassResult.status,
        payloadJson: rxClassResult.data,
        empty: rxClassResult.empty || rxClassResult.data == null,
        metadata: { medicine: medicine.name, rxcui },
      });

      if (rxClassResult.empty || rxClassResult.data == null) {
        counters.emptyCount += 1;
      } else {
        counters.successCount += 1;
        await upsertEntityMapping(db, {
          entityType: "drug",
          canonicalName: medicine.name,
          mappingType: "rxclass_lookup",
          system: "RxClass",
          code: rxcui,
          value: medicine.name,
          standardName: medicine.name,
        });
      }
    }
  }

  return rxcuiByMedicine;
}
