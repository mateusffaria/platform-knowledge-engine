# Evidence-Grounded Resume Content Planning

Resume planning converts the latest compatible persisted Curated Evidence Pack for a job into a validated JSON Resume Content Plan. It does not render a resume.

## CLI

Apply migrations and ensure the job has a persisted Curated Evidence Pack:

```bash
npm run db:migrate
npm run pke -- jobs reason <job-id>
npm run pke -- documents resume plan <job-id>
```

Options:

```text
--model <model>
--language pt-BR|en                 default: en
--length concise|standard|detailed default: standard
--json
--verbose
--no-progress
```

`--json` writes exactly one JSON plan to stdout and suppresses interactive progress. Default output is a compact terminal preview. `--verbose` adds evidence IDs, omissions, uncovered requirements, warnings, and provider/model/prompt provenance; it never prints prompts or raw provider responses. Interactive previews show transient elapsed-time feedback on stderr and automatically suppress it in CI or redirected terminals.

## Plan model and immutable identity

A plan records its job and Curated Evidence Pack IDs, language, length, professional summary, experiences, bullets, skill groups, selected evidence, omitted evidence with reasons, uncovered requirements, warnings, provider, model, prompt version, and creation time. Every bullet records supporting evidence IDs, target requirement IDs, a source organization/experience ID, exaggeration risk, and warnings.

The plan identity is SHA-256 over:

- Curated Evidence Pack ID;
- resolved provider and model;
- resume-planning prompt version;
- language;
- length.

An identical identity returns the existing immutable row without invoking the provider. A changed evidence pack, provider, model, prompt, language, or length creates a distinct plan. A database unique index resolves concurrent identical inserts to one stored winner.

## Deterministic validation

Provider output is strict JSON and cannot contain unknown fields. Before persistence, pure validators enforce:

- every factual text field cites selected evidence;
- used and omitted evidence form a complete, disjoint partition;
- unknown, rejected, discarded, superseded, or otherwise unselected evidence is rejected;
- target requirements are covered by the cited selections and missing requirements remain uncovered;
- metrics, organization, role, date, and allowlisted technology values match cited canonical metadata;
- weak/contributory evidence is not inflated and skill-only evidence does not become production experience;
- natural-language fields match `pt-BR` or `en`, excluding canonical names and technology terms;
- concise plans stay within 350 words/4 bullets, standard within 650/8, and detailed within 1,000/12.

Invalid output is never persisted. Prompt payloads expose the curated input as `eligibleEvidence` and keep discarded evidence IDs validator-side. An input-specific provider JSON Schema constrains evidence, targetable-requirement, uncovered-requirement, and source fields to their respective UUID namespaces. Within that schema, planned-experience summaries and bullets accept only experience-capable evidence and source IDs; skill-only evidence remains available to the professional summary and skill groups. A first schema-valid response that fails only evidence membership/accounting, requirement-reference/accounting, or skill-to-experience references may trigger one complete regeneration using content-safe issue codes, indexed paths, code-specific resolutions, and allowlisted offending IDs. For a selected/omitted overlap, the repair schema excludes the already-used ID from `omittedEvidence`, so the provider cannot repeat that contradiction. The application never edits or deletes invalid entries locally, and a failed regenerated draft is rejected without persistence. Factual-preservation, ownership-strength, locale, and length failures are not repaired. An individual generation may also retry one provider transport/truncation failure. Sparse evidence produces shorter content and warnings rather than padding.

## Configuration and privacy

Planning reuses `LLM_PROVIDER`, `LLM_MODEL`, `OLLAMA_BASE_URL`, and `OLLAMA_MAX_PREDICT`; `--model` overrides the configured model for one plan identity. OpenTelemetry uses the existing `OTEL_*` settings, and Langfuse uses the existing `LANGFUSE_*` settings.

Planning emits stage spans and bounded metrics for duration, inference, tokens, validation failures, and cache hits. Job, pack, plan, and run identities appear only in traces/logs, never metric labels. Langfuse is metadata-only by default. Professional evidence, prompts, and generated text are excluded unless `LANGFUSE_CAPTURE_CONTENT=true` is explicitly enabled. Export failures are fail-open.

## Storage and migration

`drizzle/0011_add_resume_content_plans.sql` adds the insert-only `resume_content_plans` snapshot table with job/pack foreign keys, lookup indexes, language/length checks, and unique plan identity. Apply it with `npm run db:migrate`.

The table is additive. To roll back application behavior, unregister or stop using the documents command; the table can remain safely unused. Export desired plans before any later destructive schema rollback.

## Evaluation and troubleshooting

The default evaluation dataset includes `resume-planning-golden-v1.json`. It covers valid English/Portuguese and concise/detailed output, sparse evidence, malformed schema, fabricated/discarded evidence, altered metrics, canonical drift, unsupported technologies, skill inflation, uncovered requirements, locale mismatch, length bounds, and stable identity reuse.

Common failures:

- “No compatible persisted Curated Evidence Pack” — run `pke jobs reason <job-id>` successfully first.
- Missing provider configuration — set `LLM_PROVIDER=ollama` and `LLM_MODEL`, or pass `--model` after configuring a provider.
- Deterministic validation failure — inspect the stable issue code, indexed path, and offending ID in the terminal diagnostic (for example, `discarded_evidence_id@omittedEvidence[2].evidenceId=<id>`); change the prompt/model or source evidence, never bypass persistence validation.
- Cached output after a request — this is expected for the same immutable identity; change a version input to create a new plan.

PDF, DOCX, HTML, visual templates, cover letters, LinkedIn content, interview answers, ATS scoring, and automated applications are explicitly out of scope.
