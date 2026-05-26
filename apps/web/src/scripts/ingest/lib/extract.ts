import { OPENFDA_LABEL_SECTION_MAP, inferPopulations } from "../utils/medical-section-map";
import { joinTextParts, normalizeText } from "../utils/normalize-text";
import type { DocumentInput, SectionInput } from "./persist";

type JsonRecord = Record<string, unknown>;

function asRecord(value: unknown): JsonRecord {
  return typeof value === "object" && value !== null ? (value as JsonRecord) : {};
}

function asString(value: unknown) {
  return typeof value === "string" ? value : undefined;
}

function asStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string");
}

function firstString(value: unknown) {
  if (typeof value === "string") {
    return value;
  }

  if (Array.isArray(value)) {
    return value.find((item): item is string => typeof item === "string");
  }

  return undefined;
}

function parseOpenFdaDate(value: unknown) {
  const text = firstString(value);

  if (!text || !/^\d{8}$/.test(text)) {
    return null;
  }

  return `${text.slice(0, 4)}-${text.slice(4, 6)}-${text.slice(6, 8)}`;
}

function openFdaNames(result: JsonRecord, field: string) {
  const openfda = asRecord(result.openfda);
  return asStringArray(openfda[field]);
}

function recursiveText(value: unknown, depth = 0): string[] {
  if (depth > 8 || value == null) {
    return [];
  }

  if (typeof value === "string") {
    const text = normalizeText(value);
    return text.length > 40 ? [text] : [];
  }

  if (Array.isArray(value)) {
    return value.flatMap((item) => recursiveText(item, depth + 1));
  }

  if (typeof value === "object") {
    const record = value as JsonRecord;
    const preferred = [
      "headline",
      "name",
      "text",
      "description",
      "url",
      "genre",
    ];

    const direct = preferred.flatMap((key) => recursiveText(record[key], depth + 1));
    const nested = Object.entries(record)
      .filter(([key]) => !preferred.includes(key))
      .flatMap(([, item]) => recursiveText(item, depth + 1));

    return [...direct, ...nested];
  }

  return [];
}

function uniqueTextBlock(value: unknown) {
  return Array.from(new Set(recursiveText(value))).join("\n\n");
}

export function extractOpenFdaLabelDocuments(input: {
  payload: unknown;
  rawSourceRecordId: string;
  medicineName: string;
  scenarioTags: string[];
  populations: string[];
}): DocumentInput[] {
  const payload = asRecord(input.payload);
  const results = Array.isArray(payload.results) ? payload.results : [];

  return results.flatMap((item, index) => {
    const result = asRecord(item);
    const id = asString(result.id) ?? asString(result.set_id) ?? `${input.medicineName}-${index}`;
    const brandNames = openFdaNames(result, "brand_name");
    const genericNames = openFdaNames(result, "generic_name");
    const title =
      brandNames[0] ||
      genericNames[0] ||
      `openFDA Drug Label: ${input.medicineName}`;
    const updatedAt = parseOpenFdaDate(result.effective_time);

    const sections = OPENFDA_LABEL_SECTION_MAP.reduce<SectionInput[]>(
      (acc, mapping, sortOrder) => {
        const originalText = joinTextParts(result[mapping.field]);

        if (!originalText) {
          return acc;
        }

        acc.push({
          sectionKey: mapping.key,
          sectionTitle: mapping.title,
          originalText,
          sortOrder,
          applicablePopulations: inferPopulations(originalText, input.populations),
          scenarioTags: input.scenarioTags,
          answerEligible: mapping.answerEligible,
          metadata: {
            openfda_field: mapping.field,
            medicine_name: input.medicineName,
          },
        });

        return acc;
      },
      [],
    );

    if (sections.length === 0) {
      return [];
    }

    return [
      {
        connectorSlug: "openfda_label",
        rawSourceRecordId: input.rawSourceRecordId,
        sourceId: `openfda-label:${id}`,
        externalId: id,
        documentTitle: title,
        sourceInstitution: "U.S. Food and Drug Administration",
        sourceType: "drug_label",
        sourceUrl: "https://open.fda.gov/apis/drug/label/",
        updatedAt,
        version: asString(result.set_id) ?? id,
        licenseNote: "openFDA public API. Verify openFDA terms for reuse.",
        countryRegion: "US",
        diseaseArea: input.scenarioTags,
        medicineNames: [input.medicineName],
        ingredientNames: genericNames,
        metadata: { source: "openfda_label", openfda: asRecord(result.openfda) },
        sections,
      },
    ];
  });
}

export function extractNdcDocuments(input: {
  payload: unknown;
  rawSourceRecordId: string;
  medicineName: string;
  scenarioTags: string[];
}) {
  const payload = asRecord(input.payload);
  const results = Array.isArray(payload.results) ? payload.results : [];

  return results.flatMap((item, index): DocumentInput[] => {
    const result = asRecord(item);
    const productNdc = asString(result.product_ndc) ?? `${input.medicineName}-${index}`;
    const title =
      asString(result.brand_name) ||
      asString(result.generic_name) ||
      `openFDA NDC: ${input.medicineName}`;
    const text = uniqueTextBlock({
      product_ndc: result.product_ndc,
      brand_name: result.brand_name,
      generic_name: result.generic_name,
      dosage_form: result.dosage_form,
      route: result.route,
      labeler_name: result.labeler_name,
      active_ingredients: result.active_ingredients,
      packaging: result.packaging,
    });

    if (!text) {
      return [];
    }

    return [
      {
        connectorSlug: "openfda_ndc",
        rawSourceRecordId: input.rawSourceRecordId,
        sourceId: `openfda-ndc:${productNdc}`,
        externalId: productNdc,
        documentTitle: title,
        sourceInstitution: "U.S. Food and Drug Administration",
        sourceType: "drug_product_metadata",
        sourceUrl: "https://open.fda.gov/apis/drug/ndc/",
        updatedAt: new Date().toISOString().slice(0, 10),
        version: asString(result.listing_expiration_date),
        licenseNote: "openFDA public API. Product metadata only.",
        countryRegion: "US",
        diseaseArea: input.scenarioTags,
        medicineNames: [input.medicineName],
        ingredientNames: asStringArray(result.generic_name),
        sections: [
          {
            sectionKey: "product_metadata",
            sectionTitle: "NDC Product Metadata",
            originalText: text,
            answerEligible: false,
            scenarioTags: input.scenarioTags,
          },
        ],
      },
    ];
  });
}

export function extractEnforcementDocuments(input: {
  payload: unknown;
  rawSourceRecordId: string;
  medicineName: string;
  scenarioTags: string[];
}) {
  const payload = asRecord(input.payload);
  const results = Array.isArray(payload.results) ? payload.results : [];

  return results.flatMap((item, index): DocumentInput[] => {
    const result = asRecord(item);
    const recallNumber =
      asString(result.recall_number) ?? `${input.medicineName}-${index}`;
    const text = uniqueTextBlock({
      reason_for_recall: result.reason_for_recall,
      product_description: result.product_description,
      recalling_firm: result.recalling_firm,
      classification: result.classification,
      status: result.status,
      distribution_pattern: result.distribution_pattern,
    });

    if (!text) {
      return [];
    }

    return [
      {
        connectorSlug: "openfda_enforcement",
        rawSourceRecordId: input.rawSourceRecordId,
        sourceId: `openfda-enforcement:${recallNumber}`,
        externalId: recallNumber,
        documentTitle: `openFDA Drug Enforcement: ${input.medicineName}`,
        sourceInstitution: "U.S. Food and Drug Administration",
        sourceType: "drug_enforcement",
        sourceUrl: "https://open.fda.gov/apis/drug/enforcement/",
        updatedAt: new Date().toISOString().slice(0, 10),
        version: asString(result.report_date),
        licenseNote: "openFDA public API. Enforcement metadata only.",
        countryRegion: "US",
        diseaseArea: input.scenarioTags,
        medicineNames: [input.medicineName],
        sections: [
          {
            sectionKey: "enforcement",
            sectionTitle: "Drug Enforcement Record",
            originalText: text,
            answerEligible: false,
            scenarioTags: input.scenarioTags,
          },
        ],
      },
    ];
  });
}

export function extractDailyMedCandidateDocuments(input: {
  payload: unknown;
  rawSourceRecordId: string;
  medicineName: string;
  scenarioTags: string[];
}) {
  const payload = asRecord(input.payload);
  const results = Array.isArray(payload.data) ? payload.data : [];

  return results.flatMap((item, index): DocumentInput[] => {
    const result = asRecord(item);
    const setId = asString(result.setid) ?? asString(result.set_id) ?? `${input.medicineName}-${index}`;
    const title =
      asString(result.title) ||
      asString(result.spl_product_data_elements) ||
      `DailyMed Label Candidate: ${input.medicineName}`;
    const text = uniqueTextBlock(result);

    if (!text) {
      return [];
    }

    return [
      {
        connectorSlug: "dailymed",
        rawSourceRecordId: input.rawSourceRecordId,
        sourceId: `dailymed:${setId}`,
        externalId: setId,
        documentTitle: title,
        sourceInstitution: "U.S. National Library of Medicine",
        sourceType: "drug_label_candidate",
        sourceUrl: "https://dailymed.nlm.nih.gov/dailymed/",
        updatedAt: new Date().toISOString().slice(0, 10),
        version: asString(result.spl_version) ?? setId,
        licenseNote: "DailyMed official NLM label data. Verify document-level terms.",
        countryRegion: "US",
        diseaseArea: input.scenarioTags,
        medicineNames: [input.medicineName],
        sections: [
          {
            sectionKey: "label_candidate",
            sectionTitle: "DailyMed Label Candidate",
            originalText: text,
            answerEligible: false,
            scenarioTags: input.scenarioTags,
          },
        ],
      },
    ];
  });
}

export function extractNhsDocument(input: {
  payload: unknown;
  rawSourceRecordId: string;
  path: string;
  scenarioTags: string[];
}) {
  const payload = asRecord(input.payload);
  const title =
    asString(payload.name) ||
    asString(payload.headline) ||
    `NHS Website Content: ${input.path}`;
  const updatedAt =
    asString(payload.dateModified)?.slice(0, 10) ||
    asString(payload.lastReviewed)?.slice(0, 10) ||
    new Date().toISOString().slice(0, 10);
  const text = uniqueTextBlock(payload);

  if (!text) {
    return null;
  }

  return {
    connectorSlug: "nhs_website_content",
    rawSourceRecordId: input.rawSourceRecordId,
    sourceId: `nhs:${input.path.replace(/^\/|\/$/g, "").replace(/\//g, ":")}`,
    externalId: input.path,
    documentTitle: title,
    sourceInstitution: "NHS England",
    sourceType: "patient_education",
    sourceUrl: `https://www.nhs.uk${input.path}`,
    updatedAt,
    licenseNote: "NHS Website Content API. Respect NHS attribution and terms.",
    countryRegion: "UK",
    diseaseArea: input.scenarioTags,
    sections: [
      {
        sectionKey: "patient_education",
        sectionTitle: "Patient Education",
        originalText: text,
        answerEligible: true,
        scenarioTags: input.scenarioTags,
      },
    ],
  } satisfies DocumentInput;
}

export function extractMedlinePlusDocument(input: {
  payload: unknown;
  rawSourceRecordId: string;
  medicineName: string;
  rxcui?: string;
  scenarioTags: string[];
}) {
  const text = uniqueTextBlock(input.payload);

  if (!text) {
    return null;
  }

  return {
    connectorSlug: "medlineplus_connect",
    rawSourceRecordId: input.rawSourceRecordId,
    sourceId: `medlineplus:${input.rxcui ?? input.medicineName}`,
    externalId: input.rxcui ?? input.medicineName,
    documentTitle: `MedlinePlus Connect: ${input.medicineName}`,
    sourceInstitution: "U.S. National Library of Medicine",
    sourceType: "patient_education",
    sourceUrl: "https://medlineplus.gov/medlineplus-connect/",
    updatedAt: new Date().toISOString().slice(0, 10),
    licenseNote: "MedlinePlus Connect official NLM service.",
    countryRegion: "US",
    diseaseArea: input.scenarioTags,
    medicineNames: [input.medicineName],
    sections: [
      {
        sectionKey: "patient_education",
        sectionTitle: "Patient Education",
        originalText: text,
        answerEligible: true,
        scenarioTags: input.scenarioTags,
      },
    ],
  } satisfies DocumentInput;
}
