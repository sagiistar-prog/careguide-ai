# CareGuide AI Design Context

## Design Position

CareGuide AI should feel human, steady, and protective without becoming sentimental or medically overconfident. The interface can provide emotional reassurance through clarity, pacing, and tone, but medical content must remain strict, sourced, and auditable.

The product is a family medication evidence workbench, not a chat interface.

## Register

product

## Design Principle

Warm interface, hard evidence.

The UI should make users feel accompanied while the system stays uncompromising about source quality. Care comes from making uncertainty visible, explaining risk calmly, and helping users prepare better questions for clinicians and pharmacists.

## Primary Users

- Family caregivers checking common household medication questions.
- Adults managing chronic conditions.
- Parents checking child fever or OTC medicine warnings.
- People helping older relatives with multiple medicines.
- Portfolio reviewers evaluating safe AI product architecture.

## User State of Mind

Users may be worried, tired, rushed, or trying to help someone else. The interface should reduce panic and reduce guesswork. It should never use urgency theatrically, and it should never hide uncertainty.

## Visual Direction

Color strategy: Restrained.

Scene sentence: A family caregiver opens the app at a kitchen table in ordinary home lighting, trying to understand a medicine label before calling a doctor or pharmacist.

Implication:

- Prefer light mode by default.
- Use calm tinted neutrals.
- Use one primary accent sparingly.
- Use semantic warning colors only for actual state and risk.
- Avoid hospital-blue defaults, biotech neon, dark command-center aesthetics, and cheerful wellness gradients.

## Tone

Voice: calm, precise, protective, plain-spoken.

Tone by moment:

- Normal evidence: clear and neutral.
- Uncertainty: honest and reassuring.
- High risk: serious, specific, and calm.
- Missing source: firm, not apologetic.
- Error: helpful and non-blaming.

Preferred phrases:

- "资料中这样描述..."
- "说明书提示..."
- "这个问题需要专业确认。"
- "当前知识库没有足够来源确认。"
- "你可以带着这些问题咨询医生或药师。"

Forbidden phrases:

- "你应该吃..."
- "建议你服用..."
- "你可以这样用药..."
- "这个药适合你..."
- "放心使用..."
- "根据经验..."

## Information Architecture

Primary routes:

- `/` Workbench home.
- `/scenarios` Scenario index.
- `/scenarios/[slug]` Scenario workbench.
- `/evidence/[answerId]` Evidence report.
- `/sources/[sourceId]` Source detail.
- `/kb` Knowledge base browser.
- `/kb/import` Source import.
- `/admin/review` Review queue.
- `/about/safety` Safety boundary.
- `/portfolio` Portfolio case study.

## Main Workbench Layout

The first screen should not be a chat box.

Recommended structure:

- Left rail or top navigation for the 12 household scenarios.
- Main evidence workspace in the center.
- Context panel for medicine name, ingredient, population, and risk tags.
- Source drawer or right panel for original excerpts.
- Bottom or side area for doctor/pharmacist confirmation questions.

The visual hierarchy should make the source trail as visible as the answer.

## Core Components

### Scenario Entry

Purpose: help users start from a household context.

Requirements:

- Use clear labels such as "儿童退烧" and "老人多药共用".
- Keep scenario options grouped to reduce cognitive load.
- Avoid identical decorative card grids. Use a compact workbench launcher with meaningful grouping.

### Medicine Input

Purpose: collect a drug name, ingredient, or label context.

Requirements:

- Show normalized matches.
- Mark ambiguous names.
- Ask for clarification when a name maps to multiple ingredients or formulations.
- Never auto-select a risky interpretation.

### Population Context Panel

Purpose: collect high-risk context without turning the product into a diagnosis tool.

Fields:

- Adult.
- Child.
- Older adult.
- Pregnancy or lactation.
- Liver or kidney condition.
- Allergy history.
- Multiple medicines.
- Chronic condition.

Copy must explain why the field matters without implying the app can decide whether a user can take a medicine.

### Evidence Card

Every evidence card must show:

- Claim summary.
- Source title.
- Source institution.
- `source_id`.
- Publication or update date.
- Version when available.
- Evidence type.
- Original excerpt.
- Confidence.
- Citation validation status.

Visual behavior:

- Summary first.
- Original excerpt visible or one click away.
- Source metadata always visible.
- Confidence shown as evidence confidence, not medical certainty.

### Source Drawer

Purpose: make trust inspectable.

Requirements:

- Show original text.
- Highlight the exact cited passage.
- Show metadata and import hash when available.
- Link to local source record, not runtime external API.

### Risk Gate Banner

Purpose: stop unsafe generation with emotional steadiness.

Good copy:

"这个问题需要专业确认。当前资料涉及儿童、剂量或高风险人群，CareGuide AI 不能判断是否适合使用。你可以把下面的问题带给医生或药师。"

Avoid:

- Alarmist language.
- Generic "seek medical advice" with no next step.
- Red-only communication.

### Conflict Panel

Purpose: show disagreement without resolving it falsely.

Requirements:

- Present source A and source B side by side.
- Show dates, versions, institutions, and excerpts.
- State that the app cannot choose a treatment decision for the user.
- Provide confirmation questions.

### Doctor or Pharmacist Questions

Purpose: convert uncertainty into a safe next action.

Requirements:

- Questions must be derived from cited evidence.
- Keep the list short.
- No diagnosis or prescription framing.

## Interaction Model

The user should move through:

1. Choose scenario.
2. Enter medicine or question.
3. Resolve ambiguity.
4. Review risk flags.
5. Inspect evidence.
6. Open original source.
7. Save or copy confirmation questions.

At every step, the user should understand why the system is asking for more information.

## Empty States

Empty states should teach the interface gently:

- "还没有选择场景。先选择一个家庭常见场景，CareGuide AI 会只检索本地权威资料。"
- "当前知识库没有找到足够来源。你可以换一个药品名、补充成分名，或导入更多官方资料。"

## Error States

Error messages must answer what happened, why, and how to fix it.

Examples:

- "没有找到可引用来源。这个问题不会生成结论。请补充药品成分名，或检查知识库是否已导入相关说明书。"
- "药品名存在多个匹配。请选择具体成分或剂型后再查看证据。"
- "来源之间存在冲突。CareGuide AI 不会替你判断用药方案，请咨询医生或药师。"

## Accessibility

Requirements:

- WCAG AA minimum contrast.
- Keyboard accessible source drawer and evidence cards.
- Icon buttons need accessible labels.
- Do not rely on color alone for risk state.
- Long excerpts must wrap cleanly.
- Chinese and English mixed text must remain readable.

## Typography

Use one highly readable UI sans stack:

`-apple-system, BlinkMacSystemFont, "Segoe UI", "Microsoft YaHei", system-ui, sans-serif`

Use restrained hierarchy:

- Dense but readable labels.
- Strong section headings only where they improve scanning.
- Body line length for prose should stay near 65 characters when possible.
- Source excerpts should use a readable text style, not tiny legal-copy styling.

## Color Tokens

Use OKLCH tokens during implementation.

Palette intent:

- Tinted neutral backgrounds.
- Muted primary accent for selection and primary actions.
- Semantic colors for warning, error, success, and info.
- Avoid pure black and pure white.
- Avoid saturated medical blue as the default brand answer.

Suggested roles:

- `background`.
- `surface`.
- `surface-muted`.
- `text-primary`.
- `text-secondary`.
- `border-subtle`.
- `primary`.
- `focus`.
- `warning`.
- `danger`.
- `success`.
- `info`.

## Icon Style

Use a consistent linear icon set, preferably lucide icons during implementation.

Likely icons:

- Search.
- FileText.
- ShieldCheck.
- AlertTriangle.
- Pill.
- Stethoscope.
- Baby.
- UserRound.
- Users.
- ClipboardCheck.
- BookOpen.
- Link.

Icons clarify state and category. They must not become decoration.

## Motion

Use motion only to communicate state:

- Evidence card expand and collapse.
- Source drawer opening.
- Risk gate reveal.
- Import progress.
- Citation validation state.

Keep transitions short and calm. Avoid celebratory animation for medical content.

## Frontend Build Rules

- Build a workbench, not a chat app.
- Use evidence cards, source panels, and workflow states as the main UI.
- Keep source traceability visible.
- Make unsupported output visibly impossible.
- Do not hide uncertainty behind confident AI language.
- Avoid marketing-style hero pages as the main product surface.
- Do not use gradient text, decorative glassmorphism, nested cards, or generic repeated icon-card grids.

## Medical Content Display Contract

No medical claim can appear without:

- `source_id`.
- Document title.
- Source institution.
- Publication or update date.
- Version when available.
- Original excerpt.
- Confidence.

If any field is missing, the UI must show:

"当前知识库无法确认。"

The UI must never quietly omit missing evidence.

## MVP Workbench UI Direction

Design lane: product workbench, restrained, human, clear.

The homepage at `/` should open directly into the usable workbench. It should not behave like a chatbot and should not read like a marketing hero. The first viewport should show:

- CareGuide AI brand area.
- A calm subtitle: "把复杂用药资料整理成家人能看懂的说明".
- Four household scenario entrances.
- A question composer.
- A knowledge base status line written in plain language.

Composition:

- Desktop: two-column workbench. Left side supports scenario choice and question entry. Right side holds results, source trail, and source drawer.
- Mobile: single-column flow with scenarios, question, result, and sources in order.
- Avoid nested cards. Use panels, dividers, bands, and compact list rows instead.
- Do not use purple gradients, glassmorphism, AI neon, hospital-dashboard density, or oversized marketing blocks.

Visual system:

- Font stack must prioritize `Alibaba PuHuiTi`, `阿里巴巴普惠体`, `PingFang SC`, and `Microsoft YaHei`.
- Use tinted neutrals with a muted green-teal primary accent and gentle warm warning accents.
- Use semantic color only for state: source verified, professional confirmation, insufficient local material, and errors.
- Motion should be short and stateful: loading skeleton, result reveal, source drawer open/close.

Copy:

- Use warm Chinese UI language.
- Do not display engineering terms such as RAG or citation validator.
- Prefer "资料来源", "原文摘录", "用药资料卡", "用药提醒", and "建议咨询医生或药师的问题".
- High-risk states should be calm and actionable: "这个问题需要医生或药师确认。你可以带着下面这些问题去咨询。"
 
Common medicine questions can show source-backed options and distinctions, but the interface must keep the decision boundary visible. For fever, the UI may group retrieved materials about commonly referenced antipyretics and show what their labels say, but it must not phrase the result as "你可以吃" or "推荐服用".
