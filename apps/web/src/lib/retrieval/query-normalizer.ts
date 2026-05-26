import { analyzeBookQuery } from "./book-query-lexicon";
import { resolveEntities } from "./entity-resolver";
import type { EntityMatch, NormalizedQuery, RetrievalDb } from "./types";

const SCENARIO_TERMS: Record<string, string[]> = {
  cold_fever: ["common cold", "fever", "acetaminophen", "paracetamol", "ibuprofen"],
  children_fever: [
    "fever in children",
    "pediatric",
    "child",
    "children",
    "acetaminophen",
    "paracetamol",
    "ibuprofen",
  ],
  hypertension: ["hypertension", "high blood pressure", "amlodipine", "lisinopril"],
  diabetes: ["diabetes", "type 2 diabetes", "metformin"],
};

const POPULATION_RULES = [
  { key: "children", values: ["儿童", "孩子", "小孩", "child", "children", "pediatric"] },
  { key: "older_adult", values: ["老人", "老年", "elderly", "older adult", "geriatric"] },
  { key: "pregnancy", values: ["孕", "怀孕", "妊娠", "pregnant", "pregnancy"] },
  { key: "adult", values: ["成人", "adult"] },
] as const;

const RISK_RULES = [
  { key: "warnings", values: ["warning", "warnings", "警示", "警告", "注意"] },
  { key: "contraindications", values: ["contraindication", "contraindications", "禁忌"] },
  { key: "adverse_reactions", values: ["side effect", "side effects", "adverse", "不良反应", "副作用"] },
  { key: "dosage", values: ["dose", "dosage", "剂量", "用量"] },
  { key: "recall", values: ["recall", "enforcement", "召回"] },
] as const;

function detectLanguage(query: string): NormalizedQuery["language"] {
  const hasZh = /[\u3400-\u9fff]/.test(query);
  const hasEn = /[a-z]/i.test(query);

  if (hasZh && hasEn) {
    return "mixed";
  }

  if (hasZh) {
    return "zh";
  }

  if (hasEn) {
    return "en";
  }

  return "unknown";
}

function includesAny(query: string, values: readonly string[]) {
  const lowered = query.toLowerCase();
  return values.some((value) => lowered.includes(value.toLowerCase()));
}

function valuesFromRules(
  query: string,
  rules: readonly { key: string; values: readonly string[] }[],
) {
  return rules
    .filter((rule) => includesAny(query, rule.values))
    .map((rule) => rule.key);
}

function byType(matches: EntityMatch[], types: string[]) {
  return matches.filter((match) => types.includes(match.entity_type));
}

function uniqueEntities(matches: EntityMatch[]) {
  const seen = new Set<string>();

  return matches.filter((match) => {
    const key = match.canonical_name;

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function ruleScenarioMatches(query: string): EntityMatch[] {
  const matches: EntityMatch[] = [];

  if (["感冒", "发热", "发烧", "退烧"].some((term) => query.includes(term))) {
    matches.push({
      id: "cold_fever",
      entity_type: "scenario",
      canonical_name: "cold_fever",
      display_name: "感冒发热",
      matched_value: "感冒发热",
      match_source: "rule",
    });
  }

  if (
    ["儿童发热", "儿童发烧", "儿童退烧", "孩子发烧", "小孩发烧"].some((term) =>
      query.includes(term),
    )
  ) {
    matches.push({
      id: "children_fever",
      entity_type: "scenario",
      canonical_name: "children_fever",
      display_name: "儿童退烧",
      matched_value: "儿童发热",
      match_source: "rule",
    });
  }

  if (["高血压", "血压"].some((term) => query.includes(term))) {
    matches.push({
      id: "hypertension",
      entity_type: "scenario",
      canonical_name: "hypertension",
      display_name: "高血压",
      matched_value: "高血压",
      match_source: "rule",
    });
  }

  if (["糖尿病", "血糖"].some((term) => query.includes(term))) {
    matches.push({
      id: "diabetes",
      entity_type: "scenario",
      canonical_name: "diabetes",
      display_name: "糖尿病",
      matched_value: "糖尿病",
      match_source: "rule",
    });
  }

  return matches;
}

export async function normalizeQuery(
  db: RetrievalDb,
  originalQuery: string,
): Promise<NormalizedQuery> {
  const trimmed = originalQuery.trim();
  const entities = await resolveEntities(db, trimmed);
  const detectedScenario = uniqueEntities([
    ...byType(entities, ["scenario"]),
    ...ruleScenarioMatches(trimmed),
  ]);
  const detectedDrugs = uniqueEntities(byType(entities, ["drug", "ingredient"]));
  const detectedConditions = byType(entities, ["disease"]);
  const detectedPopulation = valuesFromRules(trimmed, POPULATION_RULES);
  const riskTerms = valuesFromRules(trimmed, RISK_RULES);
  const bookQuery = analyzeBookQuery(trimmed);
  const sectionIntents = riskTerms.filter((term) => term !== "recall");
  const scenarioTerms = detectedScenario.flatMap(
    (scenario) => SCENARIO_TERMS[scenario.canonical_name] ?? [],
  );
  const drugTerms = detectedDrugs.flatMap((drug) => [
    drug.canonical_name,
    drug.display_name,
    drug.matched_value,
  ]);
  const populationTerms = detectedPopulation.flatMap((population) => {
    if (population === "children") {
      return ["child", "children", "pediatric"];
    }

    if (population === "older_adult") {
      return ["older adult", "elderly"];
    }

    return [population];
  });
  const riskSearchTerms = riskTerms.flatMap((term) => {
    if (term === "adverse_reactions") {
      return ["adverse reactions", "side effects"];
    }

    if (term === "contraindications") {
      return ["contraindications", "do not use"];
    }

    return [term];
  });
  const searchTerms = unique([
    trimmed,
    ...drugTerms,
    ...scenarioTerms,
    ...populationTerms,
    ...riskSearchTerms,
    ...bookQuery.expanded_terms,
  ]);

  return {
    original_query: originalQuery,
    normalized_query: searchTerms.join(" "),
    language: detectLanguage(trimmed),
    detected_drugs: detectedDrugs,
    detected_conditions: detectedConditions,
    detected_population: detectedPopulation,
    detected_scenario: detectedScenario,
    risk_terms: riskTerms,
    section_intents: sectionIntents,
    search_terms: searchTerms,
    book_intent: bookQuery.book_intent,
    expanded_terms: bookQuery.expanded_terms,
    book_query_terms: bookQuery.matched_terms,
  };
}
