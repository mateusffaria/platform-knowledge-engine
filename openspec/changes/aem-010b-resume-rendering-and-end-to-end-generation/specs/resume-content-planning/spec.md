## MODIFIED Requirements

### Requirement: Resume planning architecture and operation are documented
The project SHALL document the Curated Evidence Pack to Resume Content Plan to ResumeDocument and renderer boundaries, documents-module ownership and ports, plan schema and identity, deterministic planning and rendering validation rules, planning and generation CLI usage, provider/model/prompt configuration, privacy-safe observability, golden evaluations, migrations, and the separation between LLM-backed content planning and deterministic artifact generation.

#### Scenario: Developer implements or changes a renderer
- **WHEN** a developer reads the architecture and documents-module documentation
- **THEN** they can identify the validated Resume Content Plan and trusted candidate presentation metadata as the bounded ResumeDocument inputs and can preserve the prohibition on content generation, LLM calls, retrieval, or canonical fact changes inside renderers

#### Scenario: Roadmap is reviewed
- **WHEN** the AEM-010 and AEM-010B roadmap documentation is read
- **THEN** it distinguishes evidence-grounded JSON content planning from deterministic Markdown, HTML, and PDF artifact generation and states the scope and limitations of each milestone accurately
