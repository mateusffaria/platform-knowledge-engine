# Jobs Module

The jobs module owns external job descriptions, their deterministic requirement extraction, and bounded analysis enrichment. Job descriptions are not professional knowledge, knowledge assets, or evidence claims.

`pke jobs ingest <file>` accepts `.md`, `.markdown`, and `.txt` files. `pke jobs show <job-id>` displays their canonical model. `pke jobs analyze <job-id>` produces a separately persisted, validated analysis using the configured LLM. `pke jobs retrieve <job-id>` builds a retrieval intent and delegates ranked Evidence Pack generation to the retrieval module. `pke jobs candidates <job-id>` prepares and shows canonical candidates per deterministic requirement. `pke jobs reason <job-id>` uses those prepared candidates to persist a validated Curated Evidence Pack.

The parser recognizes common requirements, qualifications, responsibilities, and preferred sections. It preserves original text and source lines for every extraction. These deterministic requirements remain authoritative and immutable.

Job analysis is enrichment, not extraction. `JobAnalyzerAgent` receives only the canonical job source and deterministic provenance through application ports. It returns Zod-validated inferred requirements plus distinct cross-team collaboration and leadership signals, canonicalized domain signals that preserve source wording, and source-aware seniority signals. It makes the narrowest defensible inference, prefers omission to unsupported competency expansion, and never treats a source reference or warning as proof of an unsupported claim.

Successful outputs are immutable snapshots in `job_analyses`; malformed provider output is rejected without modifying the canonical job or any prior analysis. Existing v2 snapshots remain readable through the current analysis view. An identical v3 request—same canonical content hash, prompt version, provider, and resolved model—reuses its existing snapshot; changing any of those inputs creates a distinct snapshot.

Analysis-derived signals are marked inferred and can only enrich semantic retrieval text. They do not change deterministic PKQL filters, professional `EvidenceClaim` records, conflict resolution, Evidence Pack generation, or retrieval ownership. The agent does not access PostgreSQL, pgvector, repositories, or Ollama directly.

Configure the initial local provider with `LLM_PROVIDER=ollama`, `LLM_MODEL=<model>`, and `OLLAMA_BASE_URL=http://localhost:11434`. Use `--model <model>` to override the model for one analysis. Prompt versions, provider/model metadata, validation outcomes, and safe identifiers are traced through the observability port.

## Evidence reasoning

Evidence reasoning is bounded curation, not retrieval or evidence generation. Candidate preparation retrieves each deterministic requirement independently, hydrates retrieval identities from the canonical evidence store, evaluates reconciliation status, and associates retained claims only with their originating requirement. The `LlmEvidenceReasoner` receives only the resulting versioned Candidate Evidence Pack containing claim-addressable canonical evidence. It has no database, pgvector, repository, search, file-system, or unrestricted tool access.

`jobs candidates` is concise by default: it reports raw retrieval subjects, eligible and hydrated canonical claims, unique associated candidates, and candidates selected for the reasoner per requirement. `--verbose` adds retrieval intent, ranked candidates, selection outcomes, and normalized discard records; `--json` is lossless and includes every valid associated candidate plus all diagnostics. A hydrated/eligible count can exceed raw when one retrieved asset expands into multiple canonical claims.

Candidate selection is mechanical model-context control, not qualitative reasoning. `--limit-per-requirement <number>` defaults to `REASONING_CANDIDATE_LIMIT` (3 when unset); `--min-candidate-score <number>` optionally filters non-exact candidates by final retrieval score. Exact structured matches (`structuredScore >= 1`) remain visible to the reasoner even when semantic score is weak, the minimum score is unmet, or the ordinary limit is exceeded. The same controls are available on `jobs candidates` and `jobs reason`, so inspection matches the bounded reasoner input. `OLLAMA_MAX_PREDICT` defaults to 4096 tokens. Evidence reasoning uses an Ollama JSON Schema and disables hidden thinking; if a response still fails validation it retries once with an 8192-token recovery budget, then returns an explicitly degraded, non-persisted result rather than storing or presenting invented curation.

The model returns only requirement/evidence identifiers and bounded reasons. Zod validation rejects malformed, unknown, contradictory, or out-of-scope references; the application rebuilds selections and rejections from canonical input, preserves objective signals and provenance, and deterministically removes redundant cross-requirement selections. Every requirement remains explicit as `strong`, `partial`, `weak`, or `missing`; qualitative coverage and the optional display score are not hiring-fit proof.

Successful runs are immutable in `curated_evidence_packs` and record the job, selected analysis when present, candidate-pack version/hash, provider, model, prompt version, and creation time. An equivalent run is reused. Invalid provider output persists nothing and leaves the Candidate Evidence Pack unchanged.

## CLI workflow

```bash
# Store a canonical job description and capture jobDescription.job.id from the JSON output.
npm run pke -- jobs ingest examples/staff-backend-engineer-job.md --json

# Create a separate, validated JobAnalysis snapshot.
npm run pke -- jobs analyze <job-id> --verbose

# Inspect the complete persisted analysis or use it to enrich retrieval.
npm run pke -- jobs analyze <job-id> --json
npm run pke -- jobs retrieve <job-id> --verbose
npm run pke -- jobs candidates <job-id> --verbose
npm run pke -- jobs candidates <job-id> --limit-per-requirement 3 --min-candidate-score 0.5 --json
npm run pke -- jobs reason <job-id> --limit-per-requirement 3 --min-candidate-score 0.5 --verbose
```

`analyze` requires `LLM_PROVIDER=ollama` and `LLM_MODEL=<model>`. It returns clear setup guidance when either value is absent. A failed model call or invalid structured output does not persist a new analysis. Retrieval uses the latest valid snapshot and includes analysis only as semantic enrichment; deterministic PKQL filters remain unchanged.

`reason` uses the same LLM configuration and accepts `--model`, `--limit-per-requirement`, `--min-candidate-score`, `--json`, `--verbose`, and `--no-progress`. Interactive job analysis, retrieval, candidate preparation, and reasoning render terminal-only stage feedback; it is disabled for JSON and non-interactive output and is never exported through application logging or telemetry. `reason` prepares requirement-scoped candidates before entering the bounded reasoner; `--verbose` adds canonical identifiers/provenance, selection and rejection reasons, strength factors, and limitations.
