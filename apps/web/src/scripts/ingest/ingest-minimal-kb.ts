import { closeAdminClient, createAdminClient } from "./lib/db";
import {
  ensureBaseSeedData,
  failImportRun,
  finishImportRun,
  hasRawRecordsForConnector,
  markStaleRunningImportRuns,
  startImportRun,
  type ImportRunCounters,
} from "./lib/persist";
import { getScriptEnv } from "./lib/script-env";
import { ingestRxNav } from "./ingest-rxnav";
import { ingestDailyMed } from "./ingest-dailymed";
import { ingestOpenFdaLabel } from "./ingest-openfda-label";
import { ingestOpenFdaNdc } from "./ingest-openfda-ndc";
import { ingestOpenFdaEnforcement } from "./ingest-openfda-enforcement";
import { ingestMedlinePlus } from "./ingest-medlineplus";
import { ingestNhs } from "./ingest-nhs";

async function runSourceStep(
  input: {
    db: ReturnType<typeof createAdminClient>;
    label: string;
    connectorSlugs: string[];
    run: () => Promise<void>;
  },
) {
  const hasExistingRecords = await Promise.all(
    input.connectorSlugs.map((slug) =>
      hasRawRecordsForConnector(input.db, slug),
    ),
  );

  if (hasExistingRecords.every(Boolean)) {
    console.log(`Skipping step: ${input.label} (existing raw records present)`);
    return;
  }

  console.log(`Starting step: ${input.label}`);
  await input.run();
  console.log(`Completed step: ${input.label}`);
}

async function main() {
  getScriptEnv();
  const db = createAdminClient();
  try {
    await ensureBaseSeedData(db);
    await markStaleRunningImportRuns(db);

    const importRunId = await startImportRun(db, "minimal_kb");
    const counters: ImportRunCounters = {
      successCount: 0,
      failureCount: 0,
      emptyCount: 0,
      errors: [],
    };

    try {
      console.log("Starting minimal KB import");
      let rxcuiByMedicine = new Map<string, string>();

      await runSourceStep({
        db,
        label: "RxNav/RxTerms/RxClass",
        connectorSlugs: ["rxnorm", "rxterms", "rxclass"],
        run: async () => {
          rxcuiByMedicine = await ingestRxNav(db, importRunId, counters);
        },
      });

      await runSourceStep({
        db,
        label: "DailyMed",
        connectorSlugs: ["dailymed"],
        run: () => ingestDailyMed(db, importRunId, counters),
      });

      await runSourceStep({
        db,
        label: "openFDA Drug Label",
        connectorSlugs: ["openfda_label"],
        run: () => ingestOpenFdaLabel(db, importRunId, counters),
      });

      await runSourceStep({
        db,
        label: "openFDA NDC Directory",
        connectorSlugs: ["openfda_ndc"],
        run: () => ingestOpenFdaNdc(db, importRunId, counters),
      });

      await runSourceStep({
        db,
        label: "openFDA Drug Enforcement",
        connectorSlugs: ["openfda_enforcement"],
        run: () => ingestOpenFdaEnforcement(db, importRunId, counters),
      });

      await runSourceStep({
        db,
        label: "MedlinePlus Connect",
        connectorSlugs: ["medlineplus_connect"],
        run: () =>
          ingestMedlinePlus(db, importRunId, counters, rxcuiByMedicine),
      });

      await runSourceStep({
        db,
        label: "NHS Website Content API",
        connectorSlugs: ["nhs_website_content"],
        run: () => ingestNhs(db, importRunId, counters),
      });

      await finishImportRun(db, importRunId, counters);

      console.log(
        `Minimal KB import finished. import_run_id=${importRunId} success=${counters.successCount} empty=${counters.emptyCount} failures=${counters.failureCount}`,
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Minimal KB import failed.";
      await failImportRun(db, importRunId, message);
      throw error;
    }
  } finally {
    await closeAdminClient(db);
  }
}

main().catch((error) => {
  if (error instanceof Error) {
    console.error(error.message);
  } else {
    console.error("Minimal KB import failed.");
  }

  process.exit(1);
});
