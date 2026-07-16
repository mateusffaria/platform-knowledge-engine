# Jobs Module

The jobs module owns external job descriptions, their deterministic requirement extraction, and bounded analysis enrichment. Job descriptions are not professional knowledge, knowledge assets, or evidence claims.

`pke jobs ingest <file>` accepts `.md`, `.markdown`, and `.txt` files. `pke jobs show <job-id>` displays their canonical model. `pke jobs analyze <job-id>` produces a separately persisted, validated analysis using the configured LLM. `pke jobs retrieve <job-id>` builds a retrieval intent and delegates ranked Evidence Pack generation to the retrieval module.

The parser recognizes common requirements, qualifications, responsibilities, and preferred sections. It preserves original text and source lines for every extraction. These deterministic requirements remain authoritative and immutable.

Job analysis is enrichment, not extraction. `JobAnalyzerAgent` receives only the canonical job source and deterministic provenance through application ports. It returns Zod-validated inferred requirements and categorized seniority, domain, leadership, architecture, and reliability signals. Successful outputs are immutable snapshots in `job_analyses`; malformed provider output is rejected without modifying the canonical job or any prior analysis.

Analysis-derived signals are marked inferred and can only enrich semantic retrieval text. They do not change deterministic PKQL filters, professional `EvidenceClaim` records, conflict resolution, Evidence Pack generation, or retrieval ownership. The agent does not access PostgreSQL, pgvector, repositories, or Ollama directly.

Configure the initial local provider with `LLM_PROVIDER=ollama`, `LLM_MODEL=<model>`, and `OLLAMA_BASE_URL=http://localhost:11434`. Use `--model <model>` to override the model for one analysis. Prompt versions, provider/model metadata, validation outcomes, and safe identifiers are traced through the observability port.

## CLI workflow

```bash
# Store a canonical job description and capture jobDescription.job.id from the JSON output.
npm run pke -- jobs ingest examples/staff-backend-engineer-job.md --json

# Create a separate, validated JobAnalysis snapshot.
npm run pke -- jobs analyze <job-id> --verbose

# Inspect the complete persisted analysis or use it to enrich retrieval.
npm run pke -- jobs analyze <job-id> --json
npm run pke -- jobs retrieve <job-id> --verbose
```

`analyze` requires `LLM_PROVIDER=ollama` and `LLM_MODEL=<model>`. It returns clear setup guidance when either value is absent. A failed model call or invalid structured output does not persist a new analysis. Re-analyzing a job creates a newer immutable snapshot; retrieval uses the latest valid one.
