import {
  COMMON_DISEASE_TERMS,
  MEDICINE_FORM_TERMS,
  PRESCRIPTION_STRUCTURE_TERMS,
  TCM_PATTERN_TERMS,
} from "./book-query-lexicon";
import { citationSafetyFlags, toExcludedEvidence } from "./citation-safety";
import type { ExcludedEvidence, HybridCandidate, NormalizedQuery } from "./types";

const SECTION_INTENT_WEIGHTS: Record<string, string[]> = {
  warnings: ["warnings", "warning", "boxed_warning"],
  contraindications: ["contraindications"],
  adverse_reactions: ["adverse_reactions", "adverse reaction", "side effects"],
  dosage: ["dosage", "dose", "administration"],
  patient_education: ["patient_education"],
};

function sectionMatches(candidate: HybridCandidate, intents: string[]) {
  const section = `${candidate.section_key} ${candidate.section_name}`.toLowerCase();

  return intents.some((intent) =>
    (SECTION_INTENT_WEIGHTS[intent] ?? [intent]).some((term) =>
      section.includes(term.toLowerCase()),
    ),
  );
}

function isChildRelevant(candidate: HybridCandidate) {
  const text = `${candidate.section_key} ${candidate.section_name} ${candidate.document_title}`.toLowerCase();
  return (
    text.includes("child") ||
    text.includes("children") ||
    text.includes("pediatric") ||
    text.includes("infant")
  );
}

function wantsRecall(query: NormalizedQuery) {
  return query.risk_terms.includes("recall");
}

function normalizedSet(values: string[]) {
  return new Set(values.map((value) => value.toLowerCase()));
}

function candidateText(candidate: HybridCandidate) {
  return [
    candidate.source_id,
    candidate.document_title,
    candidate.book_title ?? "",
    candidate.location ?? "",
    candidate.section_key,
    candidate.section_name,
    ...candidate.medicine_names,
    ...candidate.ingredient_names,
    ...candidate.scenario_tags,
    ...(candidate.content_signals ?? []),
  ]
    .join(" ")
    .toLowerCase();
}

function includesAny(text: string, terms: readonly string[]) {
  return terms.some((term) => text.includes(term.toLowerCase()));
}

function shouldPreferDrugLabel(query: NormalizedQuery) {
  return (
    query.detected_drugs.length > 0 ||
    query.detected_population.length > 0 ||
    query.expanded_terms.some((term) =>
      ["acetaminophen", "paracetamol", "ibuprofen"].includes(term.toLowerCase()),
    ) ||
    query.risk_terms.some((term) =>
      ["warnings", "contraindications", "adverse_reactions", "dosage"].includes(term),
    )
  );
}

function wantsWesternPainRelief(query: NormalizedQuery) {
  return (
    query.detected_symptoms.some((term) =>
      ["头痛", "头疼", "疼痛", "止痛", "痛经", "经痛"].includes(term),
    ) ||
    query.expanded_terms.some((term) =>
      [
        "pain",
        "headache",
        "menstrual cramps",
        "period pain",
        "dysmenorrhea",
        "ibuprofen",
        "acetaminophen",
        "paracetamol",
      ].includes(term.toLowerCase()),
    )
  );
}

function wantsMedicationCard(query: NormalizedQuery) {
  return ["find_medicine", "dosage", "prescription"].includes(query.question_type);
}

function looksLikeMedicationCandidate(candidate: HybridCandidate) {
  const text = candidateText(candidate);

  return includesAny(text, [
    ...MEDICINE_FORM_TERMS,
    ...PRESCRIPTION_STRUCTURE_TERMS,
    "感冒清热颗粒",
    "风寒感冒颗粒",
    "荆防颗粒",
    "小青龙合剂",
    "藿香正气",
    "布洛芬",
    "对乙酰氨基酚",
    "acetaminophen",
    "ibuprofen",
    "metformin",
    "amlodipine",
    "lisinopril",
  ]);
}

function looksLikeDiseaseKnowledge(candidate: HybridCandidate) {
  const text = candidateText(candidate);

  return includesAny(text, [
    "是什么",
    "分类",
    "概述",
    "知识",
    "症状说明",
    "症状表现",
    "病因",
    "辨证",
    "第一章",
    "第二章",
  ]);
}

function matchesDetectedDrugs(candidate: HybridCandidate, query: NormalizedQuery) {
  const drugs = query.detected_drugs.map((drug) => drug.canonical_name.toLowerCase());

  if (drugs.length === 0) {
    return true;
  }

  const text = candidateText(candidate);
  return drugs.some((drug) => text.includes(drug));
}

function matchesDetectedScenario(
  candidate: HybridCandidate,
  query: NormalizedQuery,
) {
  const scenarios = query.detected_scenario.map((scenario) =>
    scenario.canonical_name.toLowerCase(),
  );

  if (scenarios.length === 0) {
    return true;
  }

  const tags = normalizedSet(candidate.scenario_tags);
  return scenarios.some((scenario) => tags.has(scenario));
}

function matchesDetectedPopulation(
  candidate: HybridCandidate,
  query: NormalizedQuery,
) {
  if (!query.detected_population.includes("children")) {
    return true;
  }

  const populations = normalizedSet(candidate.applicable_populations);

  return (
    populations.has("child") ||
    populations.has("children") ||
    populations.has("pediatric") ||
    isChildRelevant(candidate)
  );
}

export function rerankEvidence(input: {
  candidates: HybridCandidate[];
  query: NormalizedQuery;
  selectedTopK: number;
}) {
  const excluded: ExcludedEvidence[] = [];
  const documentCounts = new Map<string, number>();

  const weighted = input.candidates.flatMap((candidate) => {
    const isBookIntentBook =
      input.query.book_intent && candidate.source_type === "medical_book";
    const safetyFlags = citationSafetyFlags(candidate);

    if (safetyFlags.length > 0) {
      excluded.push(
        toExcludedEvidence(candidate, `excluded_for_${safetyFlags.join("_")}`),
      );
      return [];
    }

    if (!matchesDetectedDrugs(candidate, input.query)) {
      excluded.push(toExcludedEvidence(candidate, "detected_drug_mismatch"));
      return [];
    }

    if (!isBookIntentBook && !matchesDetectedScenario(candidate, input.query)) {
      excluded.push(toExcludedEvidence(candidate, "detected_scenario_mismatch"));
      return [];
    }

    if (!isBookIntentBook && !matchesDetectedPopulation(candidate, input.query)) {
      excluded.push(toExcludedEvidence(candidate, "detected_population_mismatch"));
      return [];
    }

    if (candidate.source_type === "drug_enforcement" && !wantsRecall(input.query)) {
      excluded.push(
        toExcludedEvidence(
          candidate,
          "drug_enforcement_only_allowed_for_recall_queries",
        ),
      );
      return [];
    }

    const why = [...candidate.why_selected];
    let score = candidate.rrf_score;

    score += 0.03;
    why.push("source_metadata_present");

    if (candidate.published_at || candidate.source_updated_at) {
      score += 0.015;
      why.push("source_date_present");
    }

    if (sectionMatches(candidate, input.query.section_intents)) {
      score += 0.08;
      why.push("section_matches_query_intent");
    }

    if (
      input.query.detected_population.includes("children") &&
      isChildRelevant(candidate)
    ) {
      score += 0.035;
      why.push("population_relevant");
    }

    if (candidate.keyword_rank != null && candidate.vector_rank != null) {
      score += 0.02;
      why.push("supported_by_keyword_and_vector");
    }

    if (isBookIntentBook) {
      score += shouldPreferDrugLabel(input.query) ? 0.05 : 0.15;
      why.push("medical_book_matches_common_condition_reference_intent");

      if (candidate.keyword_rank != null) {
        score += 0.04;
        why.push("medical_book_keyword_match");
      }

      if (looksLikeMedicationCandidate(candidate)) {
        score += input.query.medication_preference === "tcm" ? 0.22 : 0.14;
        why.push("specific_medicine_or_regimen_priority");
      }
    }

    if (
      input.query.medication_preference === "western" &&
      candidate.source_type === "medical_book"
    ) {
      score -= 0.28;
      why.push("medical_book_deprioritized_for_western_medicine_query");
    }

    if (
      input.query.book_intent &&
      includesAny(
        candidateText(candidate),
        [
          ...COMMON_DISEASE_TERMS,
          ...TCM_PATTERN_TERMS,
          ...PRESCRIPTION_STRUCTURE_TERMS,
          ...input.query.expanded_terms,
        ],
      )
    ) {
      score += 0.04;
      why.push("candidate_matches_expanded_book_terms");
    }

    if (
      shouldPreferDrugLabel(input.query) &&
      ["drug_label", "drug_label_candidate"].includes(candidate.source_type)
    ) {
      score += 0.08;
      why.push("official_drug_label_priority_for_drug_safety_query");
    }

    if (
      wantsWesternPainRelief(input.query) &&
      ["drug_label", "drug_label_candidate"].includes(candidate.source_type)
    ) {
      score += 0.18;
      why.push("western_pain_relief_label_priority");

      if (sectionMatches(candidate, ["patient_education"]) || /indications|usage|uses/i.test(`${candidate.section_key} ${candidate.section_name}`)) {
        score += 0.12;
        why.push("pain_relief_indication_section_priority");
      }
    }

    if (
      input.query.medication_preference === "western" &&
      ["drug_label", "drug_label_candidate"].includes(candidate.source_type)
    ) {
      score += 0.26;
      why.push("western_medicine_preference_priority");
    }

    if (wantsMedicationCard(input.query) && looksLikeMedicationCandidate(candidate)) {
      score += 0.1;
      why.push("medication_query_specific_card_priority");
    }

    if (wantsMedicationCard(input.query) && looksLikeDiseaseKnowledge(candidate)) {
      score -= 0.08;
      why.push("disease_knowledge_deprioritized_for_medicine_query");
    }

    const seenDocumentCount = documentCounts.get(candidate.source_document_id) ?? 0;
    documentCounts.set(candidate.source_document_id, seenDocumentCount + 1);

    if (seenDocumentCount > 0) {
      score -= 0.01 * seenDocumentCount;
      why.push("same_document_diversity_penalty");
    }

    return [
      {
        ...candidate,
        rerank_score: score,
        why_selected: Array.from(new Set(why)),
      },
    ];
  });

  const sorted = weighted.sort((a, b) => b.rerank_score - a.rerank_score);
  const selected = sorted.slice(0, input.selectedTopK);

  if (
    input.query.book_intent &&
    input.query.medication_preference !== "western"
  ) {
    const topBookMedicine = sorted.find(
      (candidate) =>
        candidate.source_type === "medical_book" &&
        looksLikeMedicationCandidate(candidate),
    );
    const topBook = sorted.find((candidate) => candidate.source_type === "medical_book");
    const topNonBook = sorted.find(
      (candidate) => candidate.source_type !== "medical_book",
    );
    const hasBook = selected.some((candidate) => candidate.source_type === "medical_book");
    const hasNonBook = selected.some(
      (candidate) => candidate.source_type !== "medical_book",
    );

    if (topBookMedicine && !selected.some((candidate) => candidate.chunk_id === topBookMedicine.chunk_id)) {
      selected.unshift(topBookMedicine);
      selected.splice(input.selectedTopK);
    } else if (topBook && !hasBook) {
      selected.unshift(topBook);
      selected.splice(input.selectedTopK);
    }

    if (topNonBook && !hasNonBook) {
      selected[selected.length === input.selectedTopK ? selected.length - 1 : selected.length] =
        topNonBook;
    }
  }

  if (wantsWesternPainRelief(input.query)) {
    const selectedIds = new Set(selected.map((candidate) => candidate.chunk_id));
    const painLabelCandidates = sorted.filter(
      (candidate) =>
        ["drug_label", "drug_label_candidate"].includes(candidate.source_type) &&
        !selectedIds.has(candidate.chunk_id),
    );

    for (const candidate of painLabelCandidates.slice(0, 4)) {
      selectedIds.add(candidate.chunk_id);

      if (selected.length < input.selectedTopK) {
        selected.push(candidate);
      } else {
        const replaceIndex = selected.findIndex(
          (item) => item.source_type === "medical_book" && looksLikeDiseaseKnowledge(item),
        );

        selected[replaceIndex >= 0 ? replaceIndex : selected.length - 1] = candidate;
      }
    }
  }

  return {
    selected: Array.from(
      selected
        .reduce((map, candidate) => {
          map.set(candidate.chunk_id, candidate);
          return map;
        }, new Map<string, HybridCandidate>())
        .values(),
    ).slice(0, input.selectedTopK),
    excluded,
  };
}
