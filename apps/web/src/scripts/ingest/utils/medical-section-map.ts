export type SectionMapping = {
  field: string;
  key: string;
  title: string;
  answerEligible: boolean;
};

export const OPENFDA_LABEL_SECTION_MAP: SectionMapping[] = [
  {
    field: "boxed_warning",
    key: "boxed_warning",
    title: "Boxed Warning",
    answerEligible: true,
  },
  {
    field: "indications_and_usage",
    key: "indications",
    title: "Indications and Usage",
    answerEligible: true,
  },
  {
    field: "warnings",
    key: "warnings",
    title: "Warnings",
    answerEligible: true,
  },
  {
    field: "warnings_and_cautions",
    key: "warnings",
    title: "Warnings and Cautions",
    answerEligible: true,
  },
  {
    field: "contraindications",
    key: "contraindications",
    title: "Contraindications",
    answerEligible: true,
  },
  {
    field: "adverse_reactions",
    key: "adverse_reactions",
    title: "Adverse Reactions",
    answerEligible: true,
  },
  {
    field: "drug_interactions",
    key: "drug_interactions",
    title: "Drug Interactions",
    answerEligible: true,
  },
  {
    field: "dosage_and_administration",
    key: "dosage",
    title: "Dosage and Administration",
    answerEligible: true,
  },
  {
    field: "pediatric_use",
    key: "pediatric_use",
    title: "Pediatric Use",
    answerEligible: true,
  },
  {
    field: "geriatric_use",
    key: "geriatric_use",
    title: "Geriatric Use",
    answerEligible: true,
  },
  {
    field: "pregnancy",
    key: "pregnancy",
    title: "Pregnancy",
    answerEligible: true,
  },
  {
    field: "description",
    key: "description",
    title: "Description",
    answerEligible: true,
  },
];

export function inferPopulations(text: string, fallback: readonly string[] = []) {
  const lower = text.toLowerCase();
  const populations = new Set(fallback);

  if (lower.includes("pediatric") || lower.includes("children")) {
    populations.add("child");
  }

  if (lower.includes("geriatric") || lower.includes("elderly")) {
    populations.add("older_adult");
  }

  if (lower.includes("pregnancy") || lower.includes("pregnant")) {
    populations.add("pregnancy");
  }

  if (lower.includes("lactation") || lower.includes("breastfeeding")) {
    populations.add("lactation");
  }

  return Array.from(populations);
}

