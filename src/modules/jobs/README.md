# Jobs Module

The jobs module owns external job descriptions and their deterministic requirement extraction. Job descriptions are not professional knowledge, knowledge assets, or evidence claims.

`pke jobs ingest <file>` accepts `.md`, `.markdown`, and `.txt` files. `pke jobs show <job-id>` displays their canonical model. `pke jobs retrieve <job-id>` builds a deterministic retrieval intent and delegates ranked Evidence Pack generation to the retrieval module.

The parser recognizes common requirements, qualifications, responsibilities, and preferred sections. It preserves original text and source lines for every extraction. Unknown or ambiguous requirements remain semantic text; no LLM, scraping, ATS scoring, resume generation, or application workflow is included.
