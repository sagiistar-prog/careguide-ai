import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { buildMedicationDisplay } from "../../components/workbench/display-adapter";
import type { QueryResponse } from "../../components/workbench/types";

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
  "src/components/workbench/LoadingState.tsx",
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
assert(uiText.includes("progressbar"), "Consult loading progressbar is missing.");
assert(uiText.includes("查询进度"), "Consult loading progress label is missing.");
assert(uiText.includes("外部检索补充"), "Card-level external search supplement is missing.");

const pollutedResult: QueryResponse = {
  request_id: "ui-smoke",
  answer_status: "answered_with_evidence",
  query: "男 25 感冒 中成药",
  detected_entities: { drugs: [], scenarios: [], population: [] },
  plain_language_summary: [],
  evidence_cards: [
    {
      card_type: "usage",
      title: "布洛芬",
      plain_language_text: "说明书提示",
      original_excerpt: "Ibuprofen label",
      citation_ids: ["drug-chunk"],
      source_ids: ["openfda_label"],
      chunk_ids: ["drug-chunk"],
      confidence: "medium",
      applicability: "",
      not_applicable_when: "",
      medication_fields: {
        medicine_name: "布洛芬",
        medicine_category: "western",
        indication: "感冒清热颗粒；处方一；处方二；洗胃处理",
        dosage: "0；2g",
        contraindications: "】本地资料未列出",
        cautions: "该卡片整理自本地资料",
      },
    },
    {
      card_type: "usage",
      title: "该卡片",
      plain_language_text: "该卡片整理自本地资料",
      original_excerpt: "该卡片整理自本地资料",
      citation_ids: ["book-chunk"],
      source_ids: ["book-source"],
      chunk_ids: ["book-chunk"],
      confidence: "medium",
      applicability: "",
      not_applicable_when: "",
      medication_fields: {
        medicine_name: "该卡片",
        medicine_category: "tcm",
      },
    },
    {
      card_type: "usage",
      title: "感冒清热颗粒",
      plain_language_text: "书中列出感冒清热颗粒。",
      original_excerpt: "感冒清热颗粒",
      citation_ids: ["book-chunk"],
      source_ids: ["book-source"],
      chunk_ids: ["book-chunk"],
      confidence: "medium",
      applicability: "",
      not_applicable_when: "",
      medication_fields: {
        medicine_name: "感冒清热颗粒",
        medicine_category: "tcm",
        indication: "风寒感冒；伤口处理",
        cautions: "】服毒后催吐、洗胃",
        external_search_note:
          "本地资料未列出；联网搜索结果可得：常见资料会把适应症、禁忌、注意事项分栏描述；广告购买信息",
      },
    },
  ],
  safety_notices: [],
  questions_for_doctor_or_pharmacist: [],
  limitations: [],
  citations: [
    {
      citation_id: "drug-chunk",
      source_id: "openfda_label",
      chunk_id: "drug-chunk",
      source_document_id: "drug-doc",
      document_title: "Ibuprofen Label",
      source_organization: "FDA",
      source_type: "drug_label",
      published_at: null,
      source_updated_at: "2026-01-01",
      section_name: "Indications and Usage",
    },
    {
      citation_id: "book-chunk",
      source_id: "book-source",
      chunk_id: "book-chunk",
      source_document_id: "book-doc",
      document_title: "家庭常见病中成药使用指南",
      source_organization: "本地授权书籍",
      source_type: "medical_book",
      book_title: "家庭常见病中成药使用指南",
      page_start: 10,
      page_end: 10,
      location: "第10页",
      published_at: null,
      source_updated_at: "2026-01-01",
      section_name: "感冒用药表",
    },
  ],
  external_search_notes: [],
  rejected_claims_count: 0,
  citation_coverage: 100,
  created_at: new Date().toISOString(),
};
const pollutedDisplay = buildMedicationDisplay(pollutedResult);
const visibleMedicationText = [
  ...pollutedDisplay.western,
  ...pollutedDisplay.tcm,
]
  .map((group) =>
    [group.name, ...Object.values(group.fields), ...group.externalNotes].join("\n"),
  )
  .join("\n");

assert(!visibleMedicationText.includes("该卡片"), "Fake medicine name leaked.");
assert(!/蛇咬伤|咬伤|伤口|服毒|催吐|洗胃|source_id|chunk_id|】/.test(visibleMedicationText), "Polluted medication text leaked.");
assert(visibleMedicationText.includes("0.2g"), "Dose punctuation normalization failed.");
assert(visibleMedicationText.includes("联网搜索结果可得"), "External supplement wording is missing.");

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
