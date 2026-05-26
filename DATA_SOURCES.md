# CareGuide AI Data Source Policy

## Purpose

This document defines which external medical data sources CareGuide AI may use.

CareGuide AI is a non-commercial portfolio project. External medical APIs are allowed only for backend ingestion, normalization, updating, and local knowledge base construction. User-facing medical answers must use the local PostgreSQL database and local RAG index only.

## Runtime Rule

During user questioning, CareGuide AI must not call external medical APIs.

Allowed at runtime:

- Local PostgreSQL queries.
- Local keyword index.
- Local vector index.
- Local source records.
- Gemini API for structured language generation using only local retrieved chunks.

Not allowed at runtime:

- Live DailyMed calls.
- Live openFDA calls.
- Live RxNorm, RxTerms, or RxClass calls.
- Live MedlinePlus calls.
- Live NCBI calls.
- Live ClinicalTrials.gov calls.
- Live NHS content calls.
- Live WHO ICD calls.
- Gemini web search, URL context, Google Search grounding, or external retrieval tools.

## Allowed Source Whitelist

### First-Stage Allowed Sources

The first implementation stage may connect only these free official sources for backend ingestion, normalization, updating, and local knowledge base construction:

- DailyMed.
- openFDA Drug Label API.
- openFDA NDC Directory API.
- openFDA Drug Enforcement API.
- RxNorm.
- RxTerms.
- RxClass.
- MedlinePlus Connect.
- NHS Website Content API.

These sources must not be called by the user-facing frontend during live user queries.

| Source | Official Owner | Access Type | CareGuide Use |
|---|---|---|---|
| DailyMed Web Services | U.S. National Library of Medicine | Free public web service | Drug label ingestion, SPL sections, label update metadata |
| openFDA Drug Label API | U.S. Food and Drug Administration | Free public API | FDA label JSON ingestion and label section mapping |
| RxNorm API | U.S. National Library of Medicine | Free public API | Drug name and RXCUI normalization |
| RxTerms API | U.S. National Library of Medicine | Free public API | Consumer-friendly medication names |
| RxClass API | U.S. National Library of Medicine | Free public API | Drug class mapping |
| MedlinePlus Connect | U.S. National Library of Medicine | Free public web service | Patient education topic links and plain-language context |
| NCBI E-utilities | U.S. National Center for Biotechnology Information | Free public API, API key improves limits | PubMed and PMC metadata retrieval |
| PMC Open Access | U.S. National Library of Medicine / NCBI | Open access subset with license terms | Open-access full text only when license permits reuse |
| ClinicalTrials.gov API | U.S. National Library of Medicine | Free public API | Clinical trial metadata, not treatment advice |
| NHS Website Content API | NHS England Digital | Official API, onboarding/key may be required | Patient education content, subject to NHS terms |
| WHO ICD API | World Health Organization | Official API, registration/key required | ICD terminology and disease coding |

## Conditional Source Review

Before adding any new source, the maintainer must confirm:

1. The source is official, governmental, academic, or institutionally authoritative.
2. The source is free for non-commercial use or free with registration.
3. The source permits the intended ingestion and display use.
4. The source provides stable identifiers or enough metadata to create `source_id`.
5. The source can be versioned and timestamped.
6. The source can be stored locally.
7. The source can expose original excerpts for citation.
8. The source is not a repost of unknown origin.

If any answer is uncertain, the source is rejected until reviewed.

## Explicitly Forbidden Sources

Never ingest, query, scrape, or display medical facts from:

- DrugBank.
- GoodRx.
- Commercial drug interaction databases.
- Commercial medical knowledge APIs.
- Commercial prescribing databases.
- Commercial pharmacy pricing databases.
- Unauthorized Chinese guideline repositories.
- Paid Chinese guideline full text.
- Paid journal article full text.
- Paid medical databases.
- News websites.
- Marketing websites.
- SEO health content farms.
- Forums.
- Social media.
- Influencer content.
- Unofficial scraped mirrors.
- AI-generated medical summaries from third-party websites.

## Gemini Policy

Gemini is not a medical source.

Gemini may only transform a local `evidence_package` into structured, plain-language UI content, or create embeddings from locally stored official text chunks. It must not answer from memory or retrieve external medical facts.

Configuration requirements:

- Do not enable Gemini URL context for medical content.
- Do not enable Google Search grounding for medical content.
- Do not attach external retrieval tools for medical content.
- Do not allow Gemini to browse unofficial sources.
- Pass only local retrieved chunks and metadata into the prompt.
- Require structured JSON output.
- Validate every medical sentence against local source chunks.
- For embeddings, pass only local `source_chunks.original_text`; do not ask Gemini to explain, enrich, or complete medical facts.

If Gemini outputs a sentence that cannot be mapped to a local source chunk, delete it or replace it with:

"当前知识库无法确认。"

## Source Metadata Required Fields

Every imported document should include:

- `source_id`.
- `source_owner`.
- `source_institution`.
- `source_url`.
- `source_type`.
- `document_title`.
- `publication_date`.
- `update_date`.
- `version`.
- `country_or_region`.
- `license_type`.
- `retrieved_at`.
- `content_hash`.
- `source_payload_hash`.
- `review_status`.

## Citation Required Fields

Every answer card must show:

- `source_id`.
- Original excerpt.
- Document title.
- Source institution.
- Publication date or update date.
- Version when available.
- Evidence type.
- Confidence.

## Unsupported Content Rule

Every sentence about medication use, contraindications, warnings, applicable population, children, older adults, pregnancy, lactation, dose, side effects, interactions, or adverse reactions must cite a local source chunk.

If not cited:

- Delete the sentence, or
- Replace it with "当前知识库无法确认。"

## Clarification Triggers

The system must ask for clarification or suggest consulting a doctor/pharmacist when:

- Drug name is uncertain.
- Formulation is uncertain.
- Ingredient mapping is ambiguous.
- Disease scenario is unclear.
- Population information is missing for a risk-sensitive question.
- User asks for child, older adult, pregnancy, lactation, liver disease, kidney disease, allergy history, multiple medicines, anticoagulants, diabetes medicines, blood pressure medicines, or dose decisions.
- Sources conflict.
- Source date or version is unclear.
- No source can support the requested conclusion.

## Official Reference Links

- DailyMed Web Services: https://dailymed.nlm.nih.gov/dailymed/app-support-web-services.cfm
- DailyMed: https://dailymed.nlm.nih.gov/dailymed/
- openFDA Drug Label API: https://open.fda.gov/apis/drug/label/
- RxNav APIs for RxNorm, RxTerms, and RxClass: https://lhncbc.nlm.nih.gov/RxNav/APIs/index.html
- MedlinePlus Connect Web Service: https://medlineplus.gov/medlineplus-connect/web-service/
- NCBI APIs and E-utilities: https://www.ncbi.nlm.nih.gov/home/develop/api/
- PMC Open Access Subset: https://pmc.ncbi.nlm.nih.gov/tools/openftlist
- ClinicalTrials.gov API: https://clinicaltrials.gov/data-api/about-api
- NHS Website Content API: https://digital.nhs.uk/developer/api-catalogue/nhs-website-content/v2
- WHO ICD API: https://icd.who.int/icdapi/docs2/
- Gemini URL Context documentation: https://ai.google.dev/gemini-api/docs/url-context
- Vertex AI grounding with external APIs: https://cloud.google.com/vertex-ai/generative-ai/docs/grounding/grounding-with-google-search-api
