import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const REQUIRED_FILES = [
  "src/app/page.tsx",
  "src/app/consult/page.tsx",
  "src/app/sources/page.tsx",
  "src/app/reminders/page.tsx",
  "src/app/settings/page.tsx",
  "src/components/landing/LandingPage.tsx",
  "src/components/landing/HeroIllustration.tsx",
  "src/components/layout/AppShell.tsx",
  "src/components/workbench/CareGuideWorkbench.tsx",
  "src/components/workbench/QuestionComposer.tsx",
  "src/components/workbench/MedicationSection.tsx",
  "src/components/workbench/MedicationDisplayCard.tsx",
  "src/components/workbench/KnowledgeSection.tsx",
  "src/components/workbench/SourceDrawer.tsx",
  "src/components/workbench/display-adapter.ts",
];
const REQUIRED_ASSETS = [
  "public/hero-careguide-3d.svg",
  "public/hero-careguide-3d.png",
];
const FORBIDDEN_VISIBLE_TERMS = [
  "证据卡片",
  "RAG",
  "citation validator",
  "Citation validator",
  "来源覆盖",
  "本地证据包",
  "先看这几句话",
  "本次整理的线索",
  "建议咨询医生或药师的问题",
  "整理资料",
  "推荐服用",
  "推荐你吃",
  "你可以吃",
  "你应该吃",
  "放心使用",
  "这个药适合你",
  "你应该服用",
  "该卡片整理自",
  "这里只呈现资料如何描述",
  "仅适用于该来源片段描述的药品、章节和人群",
  "需要留意的个人因素",
];
const SENSITIVE_MARKERS = [
  "GEMINI_API_KEY",
  "DATABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "OPENFDA_API_KEY",
  "NHS_WEBSITE_CONTENT_API_KEY",
];

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

for (const file of REQUIRED_FILES) {
  assert(statSync(join(ROOT, file)).isFile(), `Missing UI file: ${file}`);
}

for (const file of REQUIRED_ASSETS) {
  assert(statSync(join(ROOT, file)).isFile(), `Missing UI asset: ${file}`);
}

const uiText = REQUIRED_FILES.map((file) =>
  readFileSync(join(ROOT, file), "utf8"),
).join("\n");

for (const term of FORBIDDEN_VISIBLE_TERMS) {
  assert(!uiText.includes(term), `Forbidden visible term found: ${term}`);
}

for (const marker of SENSITIVE_MARKERS) {
  assert(!uiText.includes(marker), `Sensitive marker found: ${marker}`);
}

assert(
  uiText.includes("/api/query") &&
    uiText.includes("/api/kb/coverage") &&
    uiText.includes("/api/evidence/") &&
    uiText.includes("/api/sources/"),
  "Consult UI does not call the expected internal API routes.",
);
assert(uiText.includes("发送"), "Primary query button should be labeled 发送.");
assert(uiText.includes("西药") && uiText.includes("中成药"), "Medication sections missing.");
assert(uiText.includes("疾病知识或症状说明"), "Knowledge section missing.");
assert(uiText.includes("技术追溯信息"), "Source drawer should keep technical trace collapsed.");
assert(
  uiText.includes("/hero-careguide-3d.png") &&
    uiText.includes("/hero-careguide-3d.svg"),
  "Hero image path and fallback are not wired.",
);
assert(uiText.includes("正在打开咨询台"), "Landing transition copy is missing.");
assert(uiText.includes("consult-enter"), "Consult enter animation hook is missing.");

console.log(
  JSON.stringify(
    {
      status: "passed",
      checked_files: REQUIRED_FILES.length,
      checked_assets: REQUIRED_ASSETS.length,
      forbidden_visible_terms_found: false,
      sensitive_marker_found: false,
      internal_api_only_check: true,
      medication_sections_check: true,
      hero_fallback_check: true,
    },
    null,
    2,
  ),
);
