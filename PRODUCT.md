# CareGuide AI Product Context

## Product Name

CareGuide AI

## Register

product

## One Sentence

CareGuide AI is a non-commercial family medication evidence workbench that turns locally ingested, authoritative medical sources into plain-language evidence cards for common household medication questions.

## Positioning

CareGuide AI is not a medical chatbot, not an AI doctor, not a diagnosis tool, and not a prescribing system. It does not decide whether a person can take a medicine, does not recommend what medicine a user should take, and does not generate personalized treatment plans.

The product helps families understand what authoritative sources say. It presents source-backed evidence, warnings, contraindications, side effects, population-specific cautions, and questions to confirm with a doctor or pharmacist.

## Non-Commercial Scope

This is a non-commercial portfolio project. It may only use free, official, publicly accessible, or free-registration medical data APIs for backend ingestion, normalization, updating, and knowledge base construction.

Hard restrictions:

- Do not connect commercial paid medical data APIs.
- Do not connect commercial drug interaction databases.
- Do not use unauthorized Chinese guideline libraries.
- Do not scrape paid papers, paid databases, or paid Chinese guideline full text.
- Do not use marketing websites, news websites, forums, social media, SEO health blogs, or unofficial scraped content as medical sources.
- Do not treat Gemini, OpenAI, or any large language model as a medical knowledge source.

## Allowed Free Official Data Sources

These sources are allowed only for backend ingestion, normalization, updating, and local knowledge base construction. User-facing queries must retrieve from the local database and local RAG index.

| Source | Allowed Use | Notes |
|---|---|---|
| DailyMed | Drug labels, SPL sections, warnings, contraindications, adverse reactions, dosage section text for source-backed display | Official NLM service for current SPL labeling submitted to FDA |
| openFDA Drug Label API | FDA drug label JSON ingestion and label section normalization | Use as ingestion source only, not direct user-query runtime source |
| RxNorm | Drug name normalization, RXCUI mapping, ingredient and clinical drug concepts | Standardize medicine names and ingredients |
| RxTerms | Consumer-friendly drug display names | UI normalization only, not clinical advice |
| RxClass | Drug class mapping | Use for classification and retrieval filters |
| MedlinePlus Connect | Patient education topic linking and plain-language context | Use for patient education references |
| NCBI E-utilities | PubMed and PMC metadata retrieval | Use metadata and abstracts when permitted |
| PMC Open Access | Open-access full text where license permits reuse | Respect license terms and retain license metadata |
| ClinicalTrials.gov API | Trial records and study metadata | Not a treatment recommendation source |
| NHS Website Content API | Patient education content from NHS | Respect NHS terms and attribution requirements |
| WHO ICD API | Disease coding and terminology normalization | Not a treatment recommendation source |

Any new source must pass a source approval checklist before use:

- It is official or institutionally authoritative.
- It is free for this non-commercial project or free with registration.
- It permits the intended use.
- It provides stable source identifiers or enough metadata to create stable `source_id` values.
- It can be versioned, timestamped, and traced back to original text.

## Explicitly Forbidden Sources

- DrugBank.
- GoodRx.
- Commercial interaction databases.
- Paid prescribing databases.
- Unlicensed or unauthorized Chinese guideline collections.
- Paid article full text.
- Paid database exports.
- Paid Chinese guideline full text.
- News articles, marketing pages, SEO health articles, forums, social media posts, influencer content, and non-official reposts.

## LLM Policy

The first LLM provider may be Gemini API. Gemini is allowed only as a language and structure engine, never as a medical source.

Gemini must not:

- Browse the public web for medical facts.
- Use URL context tools for external medical pages.
- Use Google Search grounding for medical facts.
- Use external non-official data sources.
- Answer from model memory or general training data.
- Fill missing evidence with plausible medical knowledge.
- Generate medical advice from experience.

Gemini may:

- Classify user intent.
- Extract entities from the user question.
- Rewrite retrieved local evidence into plain language.
- Produce structured JSON that follows the CareGuide evidence schema.
- Generate doctor/pharmacist confirmation questions based only on cited local evidence.

Gemini requests must include only:

- User query.
- Locally retrieved evidence chunks.
- Source metadata.
- Safety instructions.
- Output schema.

Gemini requests must not include tool access for external medical retrieval. All user-facing medical content must be grounded in local evidence chunks.

## Runtime Architecture Rule

All external medical APIs are backend-only ingestion sources. During user questioning, the app must not call DailyMed, openFDA, RxNorm, MedlinePlus, NCBI, ClinicalTrials.gov, NHS, WHO ICD, Gemini browsing tools, or any other external medical retrieval service.

Runtime user flow:

1. User selects a household scenario or enters a medicine-related question.
2. System classifies intent, risk, entities, and missing information.
3. System retrieves only from the local PostgreSQL knowledge base and local RAG index.
4. System performs hybrid retrieval with keyword and semantic search.
5. System reranks, detects conflicts, validates citations, and applies safety gates.
6. LLM rewrites only the retrieved evidence into structured evidence cards.
7. Validator deletes unsupported sentences or replaces them with "当前知识库无法确认。"

## Medical Safety Boundary

CareGuide AI must never generate:

- "你应该吃什么药。"
- "你可以这样用药。"
- "这个药适合你。"
- "你可以放心使用。"
- Diagnosis.
- Prescription.
- Personalized treatment decisions.
- Individual dose decisions.
- Medication substitution decisions.

Allowed phrasing:

- "资料中这样描述..."
- "说明书提示..."
- "指南或患者教育资料提到..."
- "当前知识库没有足够来源确认。"
- "这个问题需要向医生或药师确认。"
- "以下是你可以带去咨询医生或药师的问题。"

## Source-Backed Output Contract

Every answer must include:

- `source_id`.
- Original excerpt.
- Document title.
- Source institution.
- Publication date or update date.
- Version when available.
- Evidence type.
- Confidence.

Every sentence involving medication use, contraindications, warnings, applicable population, children, older adults, pregnancy, lactation, dose, side effects, interactions, or adverse reactions must cite at least one source chunk.

Unsupported sentence policy:

- If a sentence has no source chunk, delete it.
- If a conclusion cannot be confirmed from local evidence, replace it with "当前知识库无法确认。"
- If sources conflict, show the conflict and do not choose a winner unless the source hierarchy and evidence policy explicitly allow it.

## Missing Information Policy

The system must ask for clarification or suggest consulting a doctor/pharmacist when:

- Drug name is uncertain.
- Ingredient mapping is ambiguous.
- Disease scenario is unclear.
- Population information is missing for a high-risk question.
- User asks about a child, older adult, pregnancy, lactation, liver disease, kidney disease, allergy history, multiple medications, anticoagulants, diabetes medicines, blood pressure medicines, or dose decisions.
- Retrieved sources conflict.
- Source quality is insufficient.

## Covered MVP Scenarios

1. Hypertension.
2. Diabetes.
3. Hyperlipidemia.
4. Cold and fever.
5. Cough and sore throat.
6. Diarrhea.
7. Acid reflux and stomach pain.
8. Allergic rhinitis.
9. Pain relief.
10. Skin inflammation.
11. Children's fever.
12. Older adults using multiple medicines.

## Core User Flows

### Family Scenario Flow

1. Select one of the 12 household scenarios.
2. Add medicine name, ingredient, symptoms, or source document context.
3. Confirm population tags such as adult, child, older adult, pregnancy, lactation, chronic condition, or multiple medicines.
4. Review risk flags before seeing evidence.
5. Read evidence cards with original excerpts.
6. Open the source drawer to verify the original text.
7. Export or copy doctor/pharmacist confirmation questions.

### Knowledge Base Admin Flow

1. Import allowed official source.
2. Attach metadata.
3. Parse source into sections and chunks.
4. Normalize medicine, ingredient, condition, population, and evidence type.
5. Generate embeddings.
6. Run citation and license validation.
7. Approve into local knowledge base.

## Knowledge Base Metadata

Each document must store:

- Source institution.
- Source URL or canonical identifier.
- Source type.
- Publication date.
- Update date.
- Version.
- Country or region.
- Disease area.
- Drug name.
- Ingredient name.
- Population.
- Evidence level.
- License type.
- Import date.
- Hash of original file or source payload.
- Review status.

## RAG Retrieval Requirements

RAG must use hybrid retrieval:

- Keyword retrieval with PostgreSQL full text search or Meilisearch.
- Semantic retrieval with pgvector embeddings.
- Metadata filters for scenario, drug, ingredient, population, country, source type, and evidence type.
- Evidence reranking with source authority and section priority.

Priority sections for drug labels:

- Contraindications.
- Warnings and precautions.
- Boxed warnings.
- Drug interactions.
- Adverse reactions.
- Use in specific populations.
- Pediatric use.
- Geriatric use.
- Pregnancy and lactation.
- Dosage and administration, only as source text, not as personalized dose advice.

## Conflict Policy

Conflicts must be detected and surfaced when:

- Two official sources disagree.
- A label and a guideline appear to differ.
- A source is outdated relative to another source.
- A drug name maps to multiple ingredients.
- A medicine has multiple formulations with different warnings.
- Population-specific statements differ.

The UI must show:

- Conflicting source cards.
- Source dates and versions.
- Original excerpts.
- A neutral note that the app cannot resolve the conflict for the user.
- A prompt to consult a doctor or pharmacist.

## Success Criteria

Product success is not measured by persuasive advice. It is measured by:

- 100% citation coverage for medical claims.
- Zero unsupported medication recommendations.
- Clear user understanding of what sources say.
- Successful high-risk interception.
- Fast source traceability.
- Low cognitive load for family users.
- Strong portfolio demonstration of safe RAG architecture.

## Portfolio Narrative

CareGuide AI should be presented as a safety-first AI product design and engineering case study:

- Local-first medical RAG.
- Official data ingestion pipeline.
- Hybrid retrieval.
- Evidence-card UI instead of chatbot UI.
- Citation validator.
- High-risk safety gates.
- Human-centered product design without unsafe medical overreach.

## Prescription Reference Handling

Authorized local prescription books may appear in answers as source-backed general prescription references. The product should not suppress prescription-book passages only because they contain medicine combinations, dose wording, or treatment patterns.

When such material is retrieved, CareGuide AI may summarize it as `书中通用处方参考` and must keep source ids, chunk ids, citations, book title, chapter/page or location, and original excerpt. The system should also explain individual applicability risks instead of lazily replacing the answer with a generic professional-confirmation message.

The boundary remains: CareGuide AI may present what the book says, but it must not invent a prescription, personalize a prescription, or say that the user should follow the regimen.

For common-disease questions, the three authorized local books may support a cited `书中通用处方参考` and `用药指南`. The product should explain individual risk factors alongside the reference instead of hiding prescription-book content or reducing the result to a generic "ask a doctor" message.

Frontend presentation should avoid placing book prose directly into the main answer. The prescription/reference regimen itself may stay faithful to the book when cited, while surrounding explanations, cautions, and reassurance should be rewritten in warm, plain Chinese. Book excerpts are shown as short traceable excerpts in the source drawer, preferably behind an explicit "查看书中出处摘录" control.

## Frontend Workbench Direction

The first public-facing UI is a family medication workbench, not a chat product and not a marketing landing page. It should help a caregiver choose a household scenario, ask a medication question, inspect plain-language source-backed results, and open the original excerpt behind each displayed item.

Frontend runtime rules:

- The browser may call only internal Next.js API routes.
- The browser must not call Gemini.
- The browser must not call DailyMed, openFDA, RxNav, MedlinePlus, NHS, or any external medical API.
- The browser must not receive or display service role keys, database URLs, raw Gemini requests, or internal logs.
- User-visible medical content must come from the backend structured answer after citation validation.

User-visible terminology:

- Use "用药资料卡" or "药物卡片", not "证据卡片".
- Use "资料来源", not "citation".
- Use "原文摘录", not "source excerpt".
- Use "用药提醒", not "safety notice".
- Use "建议咨询医生或药师的问题", not "questions for doctor or pharmacist".
- Use "当前资料不足，暂不能确认", not "insufficient evidence".
- Use "需要医生或药师确认", not "needs professional confirmation".

The UI must stay warm and supportive without offering diagnosis, prescription, personalized treatment decisions, or phrases such as "你可以吃", "推荐服用", "放心使用", or "这个药适合你".

For common scenarios such as fever, the product may show what local source-backed materials say about commonly referenced medicines, their labeled use context, and their warnings. It must still avoid deciding which medicine the user should take. The safe framing is "资料中提到..." or "说明书中这样描述...", followed by source-backed cautions and questions to confirm with a doctor or pharmacist.
