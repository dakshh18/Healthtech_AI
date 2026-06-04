# Charted — Backend

AI clinical scribe: a doctor–patient transcript goes in, a structured,
clinician-approved SOAP note (with suggested ICD-10 codes) comes out. Every
claim is grounded in the transcript, PHI is redacted before the model sees
anything, nothing finalizes without a human, and every version is logged.

> Demo / portfolio project. Synthetic data only — never feed it real patient
> information. Not a medical device and not medical advice.

## Stack

Node 20+, TypeScript, Express, Postgres 16, Zod, OpenAI (`whisper-1`,
`gpt-4o-mini`, `tts-1` for synthetic audio), multer. OpenAI is the only external
dependency. This is a transform pipeline, not RAG — no vector store, no embeddings.

## Quick start

```bash
npm install
cp .env.example .env          # fill OPENAI_API_KEY + DATABASE_URL
npm run db:init               # apply schema.sql
npm run dev                   # API on http://localhost:8080
npm test                      # unit + integration tests

npm run synth                 # generate synthetic gold set (add `-- --audio` for tts-1 clips)
npm run eval                  # score the pipeline against the gold set
```

## Eval

`npm run synth` writes synthetic consultation transcripts (gpt-4o-mini) with a
known gold set and planted PHI to `src/eval/gold/`. `npm run eval` runs each
transcript through `structure()` and scores it:

| Metric | What it measures |
|---|---|
| Schema valid | outputs that pass Zod |
| Complaint accuracy | chief complaint vs expected |
| Meds recall | expected medications found in the note |
| ICD precision/recall | suggested codes vs expected |
| Faithfulness | meds/allergies in the note that appear in the transcript (no hallucinations) |
| Redaction recall | planted PHI that got masked |

It prints a per-case table and a pass/fail summary against thresholds, and exits
non-zero on failure so it can gate CI.

## API

| Method | Path | Purpose |
|---|---|---|
| GET   | `/api/health`             | liveness + DB/model status |
| POST  | `/api/visits`             | multipart `audio` (-> Whisper) **or** JSON `{ transcript }` -> redact -> structure -> store v1 |
| GET   | `/api/visits`             | list visits |
| GET   | `/api/visits/:id`         | visit + redacted transcript + latest note |
| PATCH | `/api/visits/:id/note`    | clinician edits -> new `clinician` version (does not finalize) |
| POST  | `/api/visits/:id/approve` | the only route that finalizes -> `status='approved'` + audit |
| GET   | `/api/visits/:id/versions`| full version history + audit trail |

## Build phases

1. Setup + DB + Zod schema + redaction + structuring + transcript path (`POST/GET /api/visits`, `/api/health`). **(done)**
2. Human-in-the-loop: clinician edits, approve-only finalize, version history, audit. **(done)**
3. Audio upload -> Whisper -> Phase 1 pipeline. **(done)**
4. Synthetic data generator + eval harness. **(done)**
