Create a new OpenSpec change for the Professional Knowledge Engine.

Change name:

AEM-010B — Resume Rendering and End-to-End Generation

Context:

The Professional Knowledge Engine already supports the following pipeline:

* resume ingestion;
* deterministic parsing;
* canonical knowledge persistence;
* embeddings and hybrid retrieval;
* job description analysis;
* Candidate Evidence Pack generation;
* evidence reasoning;
* Curated Evidence Pack generation;
* Resume Content Planning;
* deterministic validation and repair;
* observability;
* evaluation scenarios.

The current pipeline stops at ResumeContentPlan.

The system can already produce evidence-grounded resume content, but it does not yet generate a final artifact that a user can review or submit in a job application.

The project goal is to generate a personalized resume for each job description.

The immediate priority is to close the end-to-end flow and deliver a functional MVP before implementing further architectural refinements.

Problem:

A ResumeContentPlan is currently displayed only as CLI text or structured data.

There is no deterministic rendering layer that transforms the plan into:

* Markdown;
* HTML;
* PDF.

Because of this, the PKE cannot yet produce the final artifact that represents its core user value.

Goal:

Implement a deterministic resume rendering and generation pipeline that transforms an existing ResumeContentPlan into a clean, readable and application-ready resume.

The milestone must close the end-to-end flow:

Source Resume
→ Canonical Knowledge
→ Job Analysis
→ Candidate Evidence Pack
→ Curated Evidence Pack
→ Resume Content Plan
→ Resume Document
→ Markdown / HTML / PDF

Primary use case:

Given a job description identifier with a successfully generated ResumeContentPlan, generate a personalized resume artifact in the requested output format.

Example command:

```bash
npm run pke -- documents resume generate \
  <job-description-id> \
  --format pdf \
  --language en \
  --length concise
```

Supported formats for the MVP:

* markdown;
* html;
* pdf.

Scope:

1. Resume document model

Introduce a deterministic ResumeDocument model derived from ResumeContentPlan.

The document model should represent the final rendered structure, including:

* candidate header;
* professional summary;
* experience sections;
* experience title;
* organization;
* dates;
* optional context or project name;
* achievement bullets;
* skills;
* education;
* certifications, when present;
* document metadata;
* provenance metadata.

The renderer must not call an LLM.

The renderer must not retrieve additional evidence.

The renderer must not modify or enrich factual content.

2. Rendering abstraction

Introduce a ResumeRenderer port or equivalent abstraction.

Suggested contract:

```ts
interface ResumeRenderer {
  render(input: RenderResumeInput): Promise<RenderedResume>;
}
```

The input should include:

* ResumeContentPlan;
* candidate profile metadata;
* selected format;
* language;
* length policy;
* template identifier;
* output destination or artifact configuration.

The output should include:

* rendered content or artifact path;
* media type;
* format;
* template version;
* source plan identifier;
* rendering identity or content hash;
* generated timestamp;
* provenance metadata.

3. Markdown renderer

Implement a deterministic Markdown renderer.

The Markdown output should:

* have a clear hierarchy;
* use standard headings;
* use concise bullet formatting;
* avoid decorative elements;
* be readable directly in source form;
* preserve section order;
* contain no unsupported content;
* be suitable as an intermediate representation.

4. HTML renderer

Implement a deterministic HTML renderer based on the same document model.

The HTML output should:

* be self-contained;
* use semantic HTML;
* contain embedded or local CSS;
* not require JavaScript;
* support print layout;
* avoid remote fonts and remote assets;
* use an ATS-friendly single-column structure;
* preserve meaningful text order;
* render consistently in a headless browser.

5. PDF renderer

Implement PDF generation from the HTML representation.

The PDF renderer should:

* produce selectable text;
* avoid rasterizing the full document;
* preserve links when supported;
* use common system fonts;
* produce an A4 document by default;
* use consistent page margins;
* avoid clipped content;
* avoid overlapping sections;
* support multi-page output;
* produce an artifact suitable for a real application.

The implementation may use a headless browser or an equivalent deterministic HTML-to-PDF adapter.

The chosen adapter must remain behind an infrastructure boundary.

6. Initial template

Implement one initial template:

```text
ats-clean-v1
```

The template should be:

* single-column;
* minimal;
* professional;
* ATS-friendly;
* readable in black and white;
* appropriate for senior and staff software engineering applications;
* optimized for one or two pages where content permits.

The MVP must not attempt to reproduce the visual design of the user’s existing resumes exactly.

The uploaded resumes may be used as structural references for expected sections and content density, but not as a requirement for pixel-level reproduction.

7. CLI command

Add a CLI command:

```bash
pke documents resume generate <job-description-id>
```

Options:

```text
--format markdown|html|pdf
--language en|pt-BR
--length concise|standard|detailed
--template ats-clean-v1
--output <path>
--force
--json
```

Expected behavior:

* load the latest compatible ResumeContentPlan;
* validate that the plan is renderable;
* construct the ResumeDocument;
* render the selected format;
* persist artifact metadata;
* write the artifact to the configured output location;
* print a concise completion summary.

Example:

```text
✓ Resume generated
format=pdf
template=ats-clean-v1
plan=<plan-id>
evidenceItems=12
output=artifacts/resumes/<filename>.pdf
```

8. End-to-end orchestration

The generate command may reuse an existing ResumeContentPlan.

When no compatible plan exists, choose one of these behaviors and document it clearly:

Preferred MVP behavior:

* fail with an actionable error telling the user to run the planning command first.

Optional behavior, only if straightforward:

* support `--plan-if-missing` to invoke planning before rendering.

Do not automatically rerun ingestion, job analysis or evidence reasoning in this milestone.

9. Traceability

Preserve traceability from final content to its source plan and evidence.

At minimum, persist:

* job_description_id;
* job_analysis_id;
* curated_evidence_pack_id;
* resume_content_plan_id;
* renderer version;
* template version;
* output format;
* language;
* length;
* artifact checksum;
* generation timestamp.

Where the current ResumeContentPlan already contains evidence references, those references must remain available in artifact metadata.

Do not expose internal evidence identifiers visibly in the resume body.

10. Persistence

Persist generated artifact metadata.

Suggested entity:

```ts
interface GeneratedResumeArtifact {
  id: string;
  jobDescriptionId: string;
  resumeContentPlanId: string;
  format: "markdown" | "html" | "pdf";
  language: "en" | "pt-BR";
  length: "concise" | "standard" | "detailed";
  templateId: string;
  templateVersion: string;
  rendererVersion: string;
  artifactPath: string;
  mediaType: string;
  checksum: string;
  createdAt: Date;
}
```

The exact schema may follow existing repository conventions.

11. Determinism and identity

For the same:

* ResumeContentPlan;
* candidate metadata;
* format;
* language;
* length;
* template version;
* renderer version;

the generated logical content must be deterministic.

Timestamps and storage paths may vary, but must not affect the logical rendering identity.

Create an artifact identity or checksum based on normalized rendering inputs.

12. Validation

Before rendering, validate:

* the plan exists;
* the plan is compatible with the requested language and length;
* required candidate metadata exists;
* selected evidence references are valid;
* no selected and omitted evidence conflict remains;
* no section contains unsupported empty placeholders;
* the document contains at least one experience or one relevant evidence-backed section.

After rendering, validate:

* output is non-empty;
* expected sections are present;
* HTML is structurally valid enough for rendering;
* PDF exists and has at least one page;
* PDF text extraction returns meaningful content;
* artifact checksum can be calculated.

13. Observability

Instrument the generation pipeline using the existing observability stack.

Suggested trace:

```text
documents.resume.generate
  load-plan
  validate-plan
  build-document
  render-markdown
  render-html
  render-pdf
  persist-artifact
  write-output
```

Suggested metrics:

* generation duration;
* rendering duration by format;
* output size;
* page count;
* selected evidence count;
* section count;
* generation failures;
* validation failures;
* cache hits or artifact reuse.

Suggested structured log fields:

* job_description_id;
* resume_content_plan_id;
* artifact_id;
* format;
* language;
* length;
* template_id;
* renderer_version;
* output_path;
* duration_ms;
* outcome;
* trace_id.

14. Artifact reuse

When an artifact already exists for the same rendering identity:

* reuse it by default;
* regenerate when `--force` is provided;
* emit an explicit cache or artifact reuse event.

15. Testing

Add unit tests for:

* ResumeDocument construction;
* section ordering;
* empty optional sections;
* Markdown escaping;
* HTML escaping;
* deterministic rendering identity;
* file naming;
* validation errors;
* renderer selection;
* artifact reuse.

Add integration tests for:

* Markdown artifact generation;
* HTML artifact generation;
* PDF artifact generation;
* multi-page PDF;
* text-selectable PDF;
* CLI output;
* persisted artifact metadata;
* `--force`;
* invalid plan;
* missing plan;
* unsupported format;
* incompatible language or length.

Add at least one end-to-end fixture covering:

```text
Job Description
→ existing Curated Evidence Pack
→ Resume Content Plan
→ Markdown
→ HTML
→ PDF
```

The fixture may initially use the current sample profile.

A real profile can be introduced after the MVP flow is complete.

16. Documentation

Update the README with:

* the complete end-to-end flow;
* prerequisites;
* planning command;
* generation command;
* supported formats;
* example outputs;
* artifact storage location;
* current MVP limitations.

Add technical documentation describing:

* ResumeDocument;
* renderer port;
* infrastructure adapters;
* template versioning;
* traceability;
* deterministic artifact identity.

Architecture constraints:

* Preserve the modular monolith and hexagonal architecture.
* Rendering belongs to the documents/resume bounded context.
* Domain and application layers must not depend directly on browser or PDF libraries.
* PDF tooling must remain behind an adapter.
* Resume rendering must be deterministic.
* No LLM call is allowed during rendering.
* No retrieval is allowed during rendering.
* No unsupported factual enrichment is allowed.
* The final resume body must contain only content derived from the ResumeContentPlan and trusted candidate metadata.
* Do not couple the system to one PDF library.
* Do not introduce external cloud services.
* The default flow must remain local-first.

Out of scope:

* Knowledge Graph evolution;
* multi-source canonical reconciliation;
* atomic compound-requirement decomposition;
* retrieval ranking improvements;
* Evidence Reasoner prompt improvements;
* Resume Content Planner quality improvements;
* automatic resume scoring;
* comparison against human-authored resumes;
* cover letters;
* LinkedIn profile generation;
* interview preparation;
* multiple visual templates;
* template editor;
* drag-and-drop customization;
* exact reproduction of existing resume designs;
* advanced typography;
* cloud artifact storage;
* public web interface.

Acceptance criteria:

* A user can generate a Markdown resume from an existing ResumeContentPlan.
* A user can generate a standalone HTML resume from the same plan.
* A user can generate a readable, selectable-text PDF from the same plan.
* All formats are produced from the same deterministic ResumeDocument.
* The PDF uses an ATS-friendly single-column template.
* No LLM is called during rendering.
* No new factual content is introduced during rendering.
* Artifact metadata preserves traceability to the job, curated evidence and content plan.
* Repeated generation with identical inputs reuses the existing artifact unless `--force` is used.
* Generation is instrumented with traces, metrics and structured logs.
* The generated artifact is persisted and its output path is displayed by the CLI.
* At least one automated end-to-end test proves the flow from ResumeContentPlan to PDF.
* The README documents how to execute the complete MVP flow.
* Existing ingestion, retrieval, reasoning, evaluation and planning tests continue to pass.

Definition of Done:

The following sequence works locally:

```bash
npm run pke -- documents resume plan \
  <job-description-id> \
  --language en \
  --length concise

npm run pke -- documents resume generate \
  <job-description-id> \
  --format pdf \
  --language en \
  --length concise
```

The second command produces a readable PDF artifact with selectable text, generated from the persisted ResumeContentPlan, with no LLM calls during rendering and with traceability metadata persisted.

The Professional Knowledge Engine then has a functional end-to-end MVP capable of producing a personalized resume artifact for a job description.


ATS-oriented resume document standard:

The source resumes are professional knowledge sources and must not define
the visual or editorial structure of generated artifacts.

The MVP must introduce a canonical ATS-oriented ResumeDocument schema.

The initial template, `ats-clean-v1`, must render the following semantic
sections in this order:

1. Candidate Header
2. Professional Summary
3. Technical Skills
4. Professional Experience
5. Education
6. Certifications

The structure must be optimized for reliable machine extraction and clear
human review rather than visual reproduction of any source resume.

Rendering requirements:

- single-column layout;
- linear and predictable reading order;
- conventional localized section headings;
- selectable text;
- no layout tables;
- no text boxes;
- no photos, logos or skill-rating graphics;
- no essential content in page headers or footers;
- no multi-column blocks;
- no remote assets;
- no scanned or rasterized full-page output;
- consistent date formats;
- reverse-chronological professional experience;
- semantic HTML elements;
- system fonts;
- A4 PDF output by default.

Section policy:

- Candidate Header is required.
- Professional Experience is required.
- Professional Summary is optional but expected.
- Technical Skills is optional but expected.
- Education is optional.
- Certifications is optional.
- Empty optional sections must be omitted.
- Section names and order are controlled by the template.
- Arbitrary section names and custom section ordering are out of scope.

Professional Experience requirements:

- Each entry must explicitly identify role, organization and employment
  period.
- Location and professional context may be included when available.
- Each achievement must preserve references to its supporting evidence.
- Achievements must be ordered according to job relevance.
- Relevant skills should appear in context when supported by evidence.
- No metric, technology, responsibility or result may be introduced without
  trusted supporting evidence.

Generated outputs:

- the user-facing resume artifact;
- a machine-readable resume manifest containing provenance, requirement
  coverage and evidence-accounting metadata.

The system must distinguish parsing readiness from job alignment.

It must not claim to reproduce a universal ATS score.

Any aggregated job-alignment score must expose its component metrics,
supporting evidence and known gaps.
