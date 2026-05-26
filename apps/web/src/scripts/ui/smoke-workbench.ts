import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(process.cwd(), "src", "components", "workbench");
const REQUIRED_FILES = [
  "CareGuideWorkbench.tsx",
  "ScenarioGrid.tsx",
  "QuestionComposer.tsx",
  "AnswerStatusBanner.tsx",
  "PlainLanguageSummary.tsx",
  "MedicationCard.tsx",
  "SafetyNoticeList.tsx",
  "PharmacistQuestions.tsx",
  "SourceList.tsx",
  "SourceDrawer.tsx",
  "KbCoverageBar.tsx",
  "EmptyState.tsx",
  "LoadingState.tsx",
  "ErrorState.tsx",
];
const FORBIDDEN_VISIBLE_TERMS = [
  "证据卡片",
  "RAG",
  "citation validator",
  "Citation validator",
  "推荐服用",
  "推荐你吃",
  "你可以吃",
  "你应该吃",
  "放心使用",
  "这个药适合你",
  "你应该服用",
];
const SENSITIVE_MARKERS = [
  "GEMINI_API_KEY",
  "DATABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "OPENFDA_API_KEY",
  "NHS_WEBSITE_CONTENT_API_KEY",
];

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    const stat = statSync(path);
    return stat.isDirectory() ? walk(path) : [path];
  });
}

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

for (const file of REQUIRED_FILES) {
  assert(
    statSync(join(ROOT, file)).isFile(),
    `Missing workbench component: ${file}`,
  );
}

const componentText = walk(ROOT)
  .map((file) => readFileSync(file, "utf8"))
  .join("\n");

for (const term of FORBIDDEN_VISIBLE_TERMS) {
  assert(!componentText.includes(term), `Forbidden visible term found: ${term}`);
}

for (const marker of SENSITIVE_MARKERS) {
  assert(!componentText.includes(marker), `Sensitive marker found: ${marker}`);
}

assert(
  componentText.includes("/api/query") &&
    componentText.includes("/api/scenarios") &&
    componentText.includes("/api/kb/coverage") &&
    componentText.includes("/api/evidence/") &&
    componentText.includes("/api/sources/"),
  "Workbench does not call the expected internal API routes.",
);

console.log(
  JSON.stringify(
    {
      status: "passed",
      component_count: REQUIRED_FILES.length,
      forbidden_visible_terms_found: false,
      sensitive_marker_found: false,
      internal_api_only_check: true,
    },
    null,
    2,
  ),
);
