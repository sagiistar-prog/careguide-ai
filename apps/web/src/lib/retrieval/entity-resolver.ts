import type { EntityMatch, RetrievalDb } from "./types";

type EntityRow = {
  id: string;
  entity_type: string;
  canonical_name: string;
  display_name: string;
};

type MappingRow = {
  entity_id: string;
  entity_type: string;
  canonical_name: string;
  display_name: string;
  value: string;
  standard_name: string | null;
};

function normalizeText(value: string) {
  return value.toLowerCase().trim();
}

function includesToken(query: string, value: string) {
  const normalized = normalizeText(value);

  if (!normalized) {
    return false;
  }

  if (/^[a-z0-9 -]+$/.test(normalized)) {
    return new RegExp(`\\b${normalized.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(
      query,
    );
  }

  return query.includes(normalized);
}

function toMatch(
  row: EntityRow | MappingRow,
  matchedValue: string,
  matchSource: EntityMatch["match_source"],
): EntityMatch {
  return {
    id: "entity_id" in row ? row.entity_id : row.id,
    entity_type: row.entity_type,
    canonical_name: row.canonical_name,
    display_name: row.display_name,
    matched_value: matchedValue,
    match_source: matchSource,
  };
}

function dedupe(matches: EntityMatch[]) {
  const seen = new Set<string>();

  return matches.filter((match) => {
    const key = `${match.entity_type}:${match.canonical_name}`;

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

const RULE_SCENARIOS = [
  {
    canonical_name: "cold_fever",
    display_name: "cold fever",
    values: ["感冒", "发热", "发烧", "退烧", "fever", "common cold"],
  },
  {
    canonical_name: "children_fever",
    display_name: "children fever",
    values: ["儿童发烧", "儿童发热", "孩子发烧", "小孩发烧", "children fever"],
  },
  {
    canonical_name: "hypertension",
    display_name: "hypertension",
    values: ["高血压", "血压", "hypertension", "high blood pressure"],
  },
  {
    canonical_name: "diabetes",
    display_name: "diabetes",
    values: ["糖尿病", "diabetes", "type 2 diabetes"],
  },
] as const;

export async function resolveEntities(db: RetrievalDb, query: string) {
  const normalizedQuery = normalizeText(query);
  const entityRows = await db<EntityRow[]>`
    select id, entity_type, canonical_name, display_name
    from public.medical_entities
    where entity_type in ('drug', 'ingredient', 'disease', 'scenario', 'population')
    order by length(canonical_name) desc
  `;
  const mappingRows = await db<MappingRow[]>`
    select
      me.id as entity_id,
      me.entity_type,
      me.canonical_name,
      me.display_name,
      em.value,
      em.standard_name
    from public.entity_mappings em
    join public.medical_entities me on me.id = em.entity_id
    order by length(em.value) desc
  `;

  const matches: EntityMatch[] = [];

  for (const row of entityRows) {
    if (includesToken(normalizedQuery, row.canonical_name)) {
      matches.push(toMatch(row, row.canonical_name, "entity"));
      continue;
    }

    if (includesToken(normalizedQuery, row.display_name)) {
      matches.push(toMatch(row, row.display_name, "entity"));
    }
  }

  for (const row of mappingRows) {
    if (includesToken(normalizedQuery, row.value)) {
      matches.push(toMatch(row, row.value, "mapping"));
      continue;
    }

    if (row.standard_name && includesToken(normalizedQuery, row.standard_name)) {
      matches.push(toMatch(row, row.standard_name, "mapping"));
    }
  }

  for (const scenario of RULE_SCENARIOS) {
    const matchedValue = scenario.values.find((value) =>
      includesToken(normalizedQuery, value),
    );

    if (matchedValue) {
      const dbScenario = entityRows.find(
        (row) =>
          row.entity_type === "scenario" &&
          row.canonical_name === scenario.canonical_name,
      );

      matches.push({
        id: dbScenario?.id ?? scenario.canonical_name,
        entity_type: "scenario",
        canonical_name: scenario.canonical_name,
        display_name: dbScenario?.display_name ?? scenario.display_name,
        matched_value: matchedValue,
        match_source: "rule",
      });
    }
  }

  return dedupe(matches);
}
