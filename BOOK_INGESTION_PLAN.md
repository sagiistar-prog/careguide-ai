# CareGuide AI Book Ingestion Plan

## Source Scope

The project includes two user-provided medical ebooks in the repository root:

- `(NEW)家庭常见病中成药使用指南_9787535985958.pdf`: 《家庭常见病中成药使用指南》
- `14516919(1).pdf`: 《常见病家庭用药指南》
- `216种常见病门诊处方全书.pdf`: 《216种常见病门诊处方全书》

They are treated as local user-provided medical guide/reference material, not as external API data. They may support patient education, family care context, background explanation, and source-backed synthesis after they pass the same local knowledge base pipeline as other sources.

Prescription-style books can be used as source-backed reference material only after OCR quality gates, chunking, retrieval, evidence package construction, citation validation, and safety guard checks. They do not disable high-risk interception and do not allow CareGuide AI to produce personalized prescriptions.

## Authorization Status

Both ebooks are marked as:

`user_provided_full_authorization`

This authorization status allows local OCR, local chunking, local indexing, and source-backed display inside CareGuide AI. It does not allow exposing the full book text through logs, API responses, frontend screens, or generated answers.

## Image PDF Strategy

Both ebooks are assumed to be image-based PDFs until proven otherwise. The first book stage is not full ingestion. It only:

1. Scans file metadata.
2. Counts PDF pages.
3. Checks whether the PDF appears scanned.
4. Selects a small page sample.
5. Runs local OCR only on the sample if local OCR tools are available.
6. Produces a safe OCR quality report without page text.

No full-book OCR, full-book embedding, Gemini reading, or frontend display happens in this stage.

## OCR Flow

The intended local OCR pipeline is:

1. Render sampled PDF pages to temporary images with a local renderer such as Poppler `pdftoppm`, MuPDF `mutool`, Ghostscript, or ImageMagick when available.
2. Run local Tesseract OCR with Chinese language data, preferably `chi_sim+eng`.
3. Capture OCR blocks with page number, block index, line order, confidence, and bbox when available.
4. Store raw OCR sample artifacts locally for review, but keep generated page text out of console logs and committed docs.
5. Save a quality report containing only counts, confidence scores, quality flags, and sampled page numbers.

If the local machine does not have a PDF renderer or OCR engine installed, scripts must report `tool_unavailable` rather than inventing OCR results.

## Page And Chapter Traceability

Book-derived chunks must preserve:

- book title
- author when available
- publisher when available
- publication year when available
- ISBN when available
- chapter title when detectable
- page start and page end, or a stable text location when page numbers cannot be recovered
- source file hash

If chapters cannot be detected automatically, the ingestion should keep page-level or location-level traceability and mark chapter title as `unknown_chapter` or `needs_review`.

## Low Confidence Handling

Pages with average OCR confidence below `0.85` are marked `needs_review`.

Pages with very low recognized character counts are marked `likely_failed`.

Drug names, dose units, contraindications, use instructions, pediatric content, pregnancy content, elderly content, adverse reactions, and warnings must not become answer-eligible chunks when OCR confidence is low. They can be retained as review material, but not used as final medical evidence until reviewed.

## Chunking Rules

Book chunks are created only after OCR quality is acceptable.

Rules:

- Do not mix different books in one chunk.
- Do not mix different chapters in one chunk.
- Do not mix distant page ranges in one chunk.
- Do not rewrite medical meaning.
- Do not use Gemini to correct OCR text silently.
- Preserve the original OCR text.
- If correction is later added, store corrected text separately and retain the original OCR text.

Every book chunk must include:

- `source_document_id`
- `source_id`
- `book_title`
- `chapter_title`
- `page_start`
- `page_end` or `location`
- `section_name`
- `chunk_text`
- `ocr_confidence`
- `chunk_hash`

## Embedding Rules

Book chunks use the existing `embed:chunks` pipeline after they are inserted into `source_chunks`.

Gemini embedding is allowed only to convert local chunk text into vectors. Gemini embedding is not a medical knowledge source and must not generate explanations during embedding.

## Citation Display Rules

Frontend source display should label book material as `参考书籍`.

Visible source details should include:

- book title
- author or publisher when available
- publication year when available
- chapter title
- page range or location
- short original excerpt

Technical trace fields such as `source_id` and `chunk_id` remain available only in a collapsed traceability area.

## No Full-Book Leakage

CareGuide AI must not:

- print full OCR pages to logs
- return full chapters through API routes
- expose full book text in frontend screens
- ask Gemini to read whole books directly
- embed entire books as one large chunk
- create a download endpoint for OCR text

Only selected, short source excerpts from retrieved evidence packages may be shown.

## Gemini Boundary

Gemini can synthesize across local evidence package items, including drug labels, patient education material, prescription-style reference excerpts, patient education material, and retrieved book excerpts. For low-risk general questions, it may summarize what the retrieved guides say about common medication choices, warnings, and care considerations, but the wording must remain source-backed and non-personalized.

Gemini cannot:

- read full ebooks outside retrieval
- use the ebook as an unrestricted prompt context
- use model memory for medical facts
- turn guide excerpts into personalized prescriptions or diagnosis
- bypass hybrid retrieval
- bypass evidence package creation
- bypass citation validation
- bypass high-risk safety guard

Every medical sentence derived from books still requires `citation_ids`, `source_ids`, and `chunk_ids`.

## Prescription Book Handling

Authorized prescription books are allowed to contribute prescription-style content to the local knowledge base. CareGuide AI should not remove or hide a passage only because it contains a prescription pattern, medicine list, dose description, contraindication, or clinical caution.

The answer layer may present retrieved book content as:

- `书中通用处方参考`
- `书中列出的常见用药方案`
- `资料中提到的门诊处方思路`

It must also explain individual applicability risks, such as:

- age
- pregnancy or lactation
- liver or kidney function
- allergy history
- current medicines
- symptom severity
- symptom duration
- comorbidities
- whether the symptoms match the condition described in the source

The system should not reduce the answer to only "consult a doctor" when prescription-book evidence exists. It should show the retrieved source-backed prescription reference, cite it, and explain where self-judgment can be risky. The remaining prohibition is narrower: do not invent a prescription, do not personalize the prescription, and do not state that the user should take the regimen.

For the three authorized local books, content should not be blocked merely because it contains prescription wording. Common-disease queries may return a cited `书中通用处方参考` and `用药指南` synthesized from retrieved book chunks. The answer should pair that reference with individual risk factors instead of hiding the content.

Frontend answers should not dump book prose as the main user-facing explanation. Prescription/reference regimens can be kept faithful to the source when cited, while all helper language should be rewritten into warm, plain-language guidance. Short original excerpts remain available for traceability, but not as a full-book or full-page display.
