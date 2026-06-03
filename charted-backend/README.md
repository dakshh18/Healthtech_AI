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
npm test                      # unit tests
```

## API (Phase 1)

| Method | Path | Purpose |
|---|---|---|
| GET  | `/api/health`     | liveness + DB/model status |
| POST | `/api/visits`     | JSON `{ transcript, patientRef? }` -> redact -> structure -> store v1 |
| GET  | `/api/visits`     | list visits |
| GET  | `/api/visits/:id` | visit + redacted transcript + latest note |

## Build phases

1. Setup + DB + Zod schema + redaction + structuring + transcript path (`POST/GET /api/visits`, `/api/health`). **(this phase)**
2. Human-in-the-loop: clinician edits, approve-only finalize, version history, audit.
3. Audio upload -> Whisper -> Phase 1 pipeline.
4. Synthetic data generator + eval harness.
