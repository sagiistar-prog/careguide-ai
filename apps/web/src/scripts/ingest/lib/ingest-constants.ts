export const MVP_SCENARIOS = [
  {
    canonicalName: "cold_fever",
    displayName: "感冒发热",
    searchTerms: ["common cold", "fever"],
  },
  {
    canonicalName: "children_fever",
    displayName: "儿童退烧",
    searchTerms: ["fever in children"],
  },
  {
    canonicalName: "hypertension",
    displayName: "高血压",
    searchTerms: ["high blood pressure", "hypertension"],
  },
  {
    canonicalName: "diabetes",
    displayName: "糖尿病",
    searchTerms: ["diabetes", "type 2 diabetes"],
  },
] as const;

export const MVP_MEDICINES = [
  {
    name: "acetaminophen",
    aliases: ["paracetamol"],
    scenarioTags: ["cold_fever", "children_fever"],
    populations: ["adult", "child"],
  },
  {
    name: "paracetamol",
    aliases: ["acetaminophen"],
    scenarioTags: ["cold_fever", "children_fever"],
    populations: ["adult", "child"],
  },
  {
    name: "ibuprofen",
    aliases: [],
    scenarioTags: ["cold_fever", "children_fever"],
    populations: ["adult", "child"],
  },
  {
    name: "amlodipine",
    aliases: [],
    scenarioTags: ["hypertension"],
    populations: ["adult", "older_adult"],
  },
  {
    name: "lisinopril",
    aliases: [],
    scenarioTags: ["hypertension"],
    populations: ["adult", "older_adult"],
  },
  {
    name: "metformin",
    aliases: [],
    scenarioTags: ["diabetes"],
    populations: ["adult", "older_adult"],
  },
] as const;

export const NHS_CONTENT_PATHS = [
  {
    path: "/conditions/common-cold/",
    scenarioTags: ["cold_fever"],
  },
  {
    path: "/conditions/fever-in-children/",
    scenarioTags: ["children_fever"],
  },
  {
    path: "/conditions/high-blood-pressure-hypertension/",
    scenarioTags: ["hypertension"],
  },
  {
    path: "/conditions/type-2-diabetes/",
    scenarioTags: ["diabetes"],
  },
] as const;

