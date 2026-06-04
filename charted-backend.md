# Charted — Backend Build Guide

> **Charted** is an AI clinical scribe. A (synthetic) doctor–patient conversation goes in as audio; a structured, **clinician-approved** SOAP note with suggested ICD-10 codes comes out. Every claim is grounded in the transcript, PHI is redacted before the model sees anything, nothing finalizes without a human, and every version is logged.

> ⚠️ Demo / portfolio project. Uses **synthetic data only** — never feed it real patient information. Not a medical device and not medical advice.

---

## 1. The problem this solves

Clinicians spend a large share of every day writing notes, and documentation is one of the biggest drivers of burnout. They also under-code visits, which costs clinics revenue. Charted turns the conversation that just happened into a ready-to-edit structured draft in seconds, so the clinician *reviews and corrects* instead of *writing from memory*.

## 2. Why this is not a toy (say these in interviews)

- **Constrained structured output** — the model returns typed JSON validated against a Zod schema, not free text you parse with regex. Invalid output is retried, not trusted.
- **PHI redaction before inference** — sensitive data is masked before it ever reaches the model.
- **Human-in-the-loop, no auto-finalize** — the AI only ever produces a *draft*. A clinician must approve.
- **Full audit + versioning** — every AI draft and every clinician edit is a stored, diffable version.
- **An eval harness** — extraction accuracy, ICD precision/recall, faithfulness, and redaction recall scored against a synthetic gold set.
- **Cost-aware by design** — `gpt-4o-mini` + `whisper-1`, response caching, and a hard spend cap.

## 3. The pipeline

```
audio file ─▶ Whisper (transcribe) ─▶ PHI redaction ─▶ structuring (gpt-4o-mini, JSON)
                                                              │
                                                              ▼
                                                   Zod validate (retry on fail)
                                                              │
                                                              ▼
                                            persist as note version 1 (source = "ai")
                                                              │
                                  clinician edits ──▶ new version (source = "clinician")
                                                              │
                                              approve ──▶ status = approved + audit entry
```

Note: this is **not** RAG. There is no vector store and no embeddings — it's a transform pipeline. That keeps it cheap and is a deliberate point of difference from a retrieval project.

## 4. Tech stack

| Layer | Choice | Cost |
|---|---|---|
| Runtime | Node.js 20+, TypeScript, `tsx` | free |
| API | Express | free |
| Transcription | OpenAI `whisper-1` | OpenAI key |
| Structuring | OpenAI `gpt-4o-mini` (structured outputs) | OpenAI key |
| Synthetic audio (dev only) | OpenAI `tts-1` | OpenAI key |
| Validation | Zod | free |
| Database | Postgres 16 (Neon free tier or local Docker) | free |
| File upload | `multer` (memory storage) | free |

No paid vector DB, no Tavily, no second LLM provider. One OpenAI key covers transcription, structuring, and test-data generation.

## 5. Folder structure

```
charted-backend/
├── src/
│   ├── server.ts                 Express app + middleware + routes
│   ├── db/
│   │   ├── pool.ts               pg Pool
│   │   └── schema.sql            tables + indexes
│   ├── routes/
│   │   ├── health.ts
│   │   ├── visits.ts            create, list, get, patch note, approve, versions
│   │   └── dev.ts              synthetic data generation (guarded by NODE_ENV)
│   ├── pipeline/
│   │   ├── transcribe.ts        Whisper
│   │   ├── redact.ts            PHI masking (deterministic + optional model)
│   │   ├── structure.ts         gpt-4o-mini → SOAP JSON
│   │   └── run.ts               orchestrates the full pipeline
│   ├── schema/
│   │   └── soap.ts              Zod SOAP + ICD schema (the contract)
│   ├── lib/
│   │   ├── openai.ts            single OpenAI client
│   │   ├── cache.ts             hash-keyed response cache
│   │   └── audit.ts             writeAudit()
│   └── eval/
│       ├── gold/                synthetic transcripts + expected JSON
│       ├── run-eval.ts          scores the pipeline
│       └── synth.ts             generates gold set (GPT) + audio (TTS)
├── .env.example
├── package.json
└── README.md
```

## 6. Data model (`db/schema.sql`)

```sql
create table visits (
  id            uuid primary key default gen_random_uuid(),
  patient_ref   text not null,            -- synthetic, e.g. "SYN-0412"
  status        text not null default 'draft',  -- 'draft' | 'approved'
  audio_seconds int,
  created_at    timestamptz not null default now()
);

create table transcripts (
  id            uuid primary key default gen_random_uuid(),
  visit_id      uuid not null references visits(id) on delete cascade,
  raw_text      text not null,
  redacted_text text not null,
  created_at    timestamptz not null default now()
);

create table note_versions (
  id           uuid primary key default gen_random_uuid(),
  visit_id     uuid not null references visits(id) on delete cascade,
  version_no   int  not null,
  soap         jsonb not null,            -- validated SoapNote
  source       text not null,             -- 'ai' | 'clinician'
  author       text not null default 'system',
  created_at   timestamptz not null default now(),
  unique (visit_id, version_no)
);

create table audit_log (
  id         bigserial primary key,
  visit_id   uuid references visits(id) on delete cascade,
  action     text not null,               -- 'transcribed' | 'structured' | 'edited' | 'approved'
  actor      text not null,
  detail     jsonb,
  created_at timestamptz not null default now()
);

create index on note_versions (visit_id, version_no desc);
create index on audit_log (visit_id, created_at desc);
```

## 7. The contract — Zod SOAP schema (`schema/soap.ts`)

This is the single most important file. It is both the OpenAI structured-output schema and the runtime validator.

```ts
import { z } from "zod";

export const IcdCode = z.object({
  code: z.string(),                       // "J02.9"
  description: z.string(),                // "Acute pharyngitis, unspecified"
  confidence: z.number().min(0).max(1),
  rationale: z.string(),                  // why the model picked it
});

export const Flag = z.object({
  section: z.enum(["subjective", "objective", "assessment", "plan"]),
  reason: z.string(),                     // e.g. "diagnosis not stated explicitly"
});

export const SoapNote = z.object({
  chiefComplaint: z.string(),
  subjective: z.string(),
  objective: z.string(),
  assessment: z.string(),
  plan: z.string(),
  medications: z.array(z.string()),
  allergies: z.array(z.string()),
  vitals: z.object({
    tempC: z.number().nullable(),
    hr: z.number().nullable(),
    bp: z.string().nullable(),
  }),
  icdCodes: z.array(IcdCode),
  flags: z.array(Flag),                   // low-confidence / unsupported spots
});

export type SoapNote = z.infer<typeof SoapNote>;
```

## 8. Pipeline steps

### 8.1 Transcribe (`pipeline/transcribe.ts`)
```ts
import fs from "node:fs";
import { openai } from "../lib/openai";

export async function transcribe(audioPath: string): Promise<string> {
  const res = await openai.audio.transcriptions.create({
    model: "whisper-1",
    file: fs.createReadStream(audioPath),
  });
  return res.text;
}
```

### 8.2 Redact (`pipeline/redact.ts`)
Deterministic first (cheap, predictable), with an optional model pass for stray names. The model in step 8.3 only ever sees `redacted`.
```ts
const PATTERNS: [RegExp, string][] = [
  [/\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/g, "[PHONE]"],
  [/\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/g, "[DATE]"],
  [/\b[\w.+-]+@[\w-]+\.[\w.-]+\b/g, "[EMAIL]"],
  // extend: SIN/SSN, postal codes, etc.
];

export function redact(raw: string): string {
  return PATTERNS.reduce((t, [re, tag]) => t.replace(re, tag), raw);
}
```
> Track a **redaction-recall** metric in the eval: plant known PHI into synthetic transcripts and measure how much gets masked.

### 8.3 Structure (`pipeline/structure.ts`)
Use OpenAI structured outputs so the model is forced to match the schema. Validate with Zod anyway, and retry once.
```ts
import { zodResponseFormat } from "openai/helpers/zod";
import { SoapNote } from "../schema/soap";
import { openai } from "../lib/openai";

const SYSTEM = `You are a clinical documentation assistant. Convert the transcript into a SOAP note.
Rules:
- Use ONLY information present in the transcript. Never invent findings, meds, or history.
- If a section is unsupported or uncertain, fill it minimally and add a flag explaining why.
- Suggest ICD-10 codes only when justified; include a confidence and a one-line rationale.`;

export async function structure(transcript: string): Promise<SoapNote> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.2,
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: transcript },
      ],
      response_format: zodResponseFormat(SoapNote, "soap_note"),
    });
    const parsed = SoapNote.safeParse(
      JSON.parse(res.choices[0].message.content ?? "{}")
    );
    if (parsed.success) return parsed.data;
  }
  throw new Error("Structuring failed schema validation after retries");
}
```

### 8.4 Orchestrate (`pipeline/run.ts`)
```ts
export async function runPipeline(visitId: string, audioPath: string) {
  const raw = await transcribe(audioPath);
  const redacted = redact(raw);
  await saveTranscript(visitId, raw, redacted);
  await writeAudit(visitId, "transcribed", "system");

  const soap = await cached(redacted, () => structure(redacted)); // hash-keyed cache
  await saveNoteVersion(visitId, 1, soap, "ai");
  await writeAudit(visitId, "structured", "system", { flags: soap.flags.length });
  return soap;
}
```

## 9. API endpoints

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/health` | liveness + DB/model status |
| POST | `/api/visits` | multipart `audio` **or** JSON `{ transcript }` (v1 path) → runs pipeline |
| GET | `/api/visits` | list visits for the sidebar (id, ref, status, date) |
| GET | `/api/visits/:id` | visit + redacted transcript + latest note version |
| PATCH | `/api/visits/:id/note` | save clinician edits → creates a new `clinician` version |
| POST | `/api/visits/:id/approve` | finalize → `status='approved'` + audit |
| GET | `/api/visits/:id/versions` | full version history (the audit view) |
| POST | `/api/dev/seed` | dev-only: generate synthetic transcript(+audio) |

Keep processing synchronous for v1 (await the pipeline, return the note). If you want polish later, stream structuring tokens over SSE like Landed did — but it's optional here because this is a one-shot transform, not a chat loop.

## 10. Synthetic data — the cost-free test loop

You never need real audio. Generate everything with the one key:

`eval/synth.ts`:
1. Ask `gpt-4o-mini` to write N realistic consultation transcripts across varied complaints (sore throat, back pain, UTI, anxiety, etc.). Have it also emit the **expected** structured fields → that becomes your gold set.
2. Optionally run each transcript through `tts-1` (use two voices for doctor/patient) to produce `eval/gold/*.mp3` for end-to-end audio testing.
3. Whisper transcribes that audio back → pipeline → compare to expected.

```ts
const res = await openai.audio.speech.create({
  model: "tts-1", voice: "alloy", input: transcriptLine,
});
```
> Honest caveat: TTS audio transcribes almost too cleanly. For one or two "messy" samples, record yourself reading a transcript aloud.

## 11. Eval harness (`eval/run-eval.ts`)

Run with `npm run eval`. For each gold case, run `structure(transcript)` (skip audio) and score:

| Metric | What it measures |
|---|---|
| JSON validity | % of outputs that pass Zod first try |
| Field accuracy | chief complaint / meds / allergies vs expected |
| ICD precision & recall | suggested codes vs expected codes |
| Faithfulness | % of meds/findings in the note that appear in the transcript (no hallucinations) |
| Redaction recall | % of planted PHI that got masked |

Print a table and a pass/fail against thresholds you set. This table *is* a resume bullet.

## 12. Safety backstops

- PHI redaction runs before any model call.
- The AI output is always a **draft**; only `POST /approve` finalizes, and it's the only route that flips status.
- Faithfulness check can hard-flag any med/finding not found in the transcript.
- Rate limiting on write routes; stateless API (no session storage).
- Synthetic data only — enforced by a banner and a seeded dataset.

## 13. Cost controls

- `gpt-4o-mini` + `whisper-1` only; no embeddings (not RAG).
- Hash-keyed cache (`lib/cache.ts`) so re-running the same transcript doesn't re-bill.
- Set a **hard monthly usage limit** in the OpenAI dashboard.
- Demo runs on a handful of synthetic cases, not a large corpus.

## 14. Environment (`.env.example`)
```
OPENAI_API_KEY=sk-...
DATABASE_URL=postgres://...
PORT=8080
NODE_ENV=development
```

## 15. Quick start
```bash
cd charted-backend
npm install
cp .env.example .env          # fill OPENAI_API_KEY + DATABASE_URL
npm run db:init               # apply schema.sql
npm run synth                 # generate synthetic gold set (+ optional audio)
npm run dev                   # API on http://localhost:8080
npm run eval                  # score the pipeline
```

## 16. Suggested build order
1. **v1** — `POST /api/visits` accepting a pasted `transcript` → structure → store → `GET /:id`. Nails the hard part with zero audio.
2. **v2** — add audio upload → Whisper → feed v1.
3. **v3** — add the eval harness + synthetic generator, then redaction metrics.
4. **Polish** — SSE streaming of the structuring step, PDF export of approved notes.
