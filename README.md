# Charted — AI-Native EHR

Charted is a small **electronic health record (EHR) platform** built around an **AI clinical scribe**.
Patients book appointments, doctors run the visit, and an AI turns the doctor–patient
conversation into a structured, **clinician-approved** SOAP note with suggested ICD-10 codes —
which then flows into prescriptions and the patient's chart. Audio (or a pasted transcript)
goes in; a typed, schema-validated draft comes out in seconds. Every claim is grounded in the
transcript, PHI is redacted before any model sees it, **nothing finalizes without a human**,
and every version is logged.

- **Live demo:** https://healthtechai.netlify.app
- **API health:** https://charted-daksh.duckdns.org/api/health
- **Walkthrough video:** [`sr.mp4`](sr.mp4) — record → transcribe → review → approve, end to end

> Portfolio / demo project. **Synthetic data only** — not a medical device and not medical advice.

---

## What it does

A complete clinic workflow, with the AI scribe as the centerpiece:

```
Patient books an appointment ─▶ Doctor confirms ─▶ Doctor starts the visit
        (paste/record the consultation)
                  │
   Whisper transcribe ─▶ PHI redaction ─▶ gpt-4o-mini structured output ─▶ Zod validate
                  │
        SOAP note draft ─▶ doctor reviews & edits (versioned) ─▶ approves
                  │
   Prescription issued (medications auto-filled from the approved note)
                  │
   Everything appears on the patient's chart + the system audit log
```

The **appointment → visit → note** path is the bridge that ties an ordinary clinic
workflow to the AI pipeline.

## Roles

Three roles, enforced by JWT auth + role-based middleware on every route:

| Role | Can do |
|---|---|
| **Patient** | Register, browse doctors, book/cancel appointments, view their own chart (visits, notes, prescriptions) |
| **Doctor** | Manage a public profile, see their schedule, confirm/reject appointments, **run the scribe**, edit & approve notes, issue prescriptions, view any patient's chart |
| **Admin** | Everything above + a dashboard: manage users (change roles, activate/deactivate), system stats, and a global audit feed |

## Features

- **AI clinical scribe** — audio or transcript → SOAP note + ICD-10 codes, in seconds.
- **Appointments** — booking with status lifecycle (`PENDING → CONFIRMED → COMPLETED`, plus reject/cancel); starting a confirmed appointment creates the visit and runs the scribe.
- **Prescriptions** — issued only from an **approved** visit; medication list **auto-fills from the AI note**, and the doctor adds dosage/frequency/duration.
- **Patient chart** — a per-patient timeline merging appointments, visits (with note summaries), and prescriptions.
- **Admin dashboard** — user management, counts by role/status, and a system-wide activity feed.
- **Auth & RBAC** — JWT sessions, bcrypt-hashed passwords, deactivatable accounts.

## Why it's more than a CRUD app

- **Constrained structured output** — the model returns typed JSON validated against a
  **Zod** schema (not free text parsed with regex). The schema is sent to OpenAI as a
  strict response format, and the parsed result is re-validated in code. Invalid output
  is **retried, not trusted**.
- **PHI redaction before inference** — names, dates, phone numbers, etc. are masked
  *before* the transcript ever reaches the model. Patient demographics are extracted
  **deterministically (no model)** and shown only in the chart header, never sent to the LLM.
- **No hallucinated vitals** — the structuring schema is rewritten so unstated vitals
  resolve to `null` instead of the model inventing `0`/`""` to satisfy a required field
  (see [`structure.ts`](charted-backend/src/pipeline/structure.ts)).
- **Human-in-the-loop, no auto-finalize** — the AI only ever produces a *draft*. A
  single `approve` route is the only thing that can finalize a note, and prescriptions
  can only be issued from an approved note.
- **Full audit + versioning** — every AI draft and every clinician edit is a stored,
  diffable version, with an action log surfaced in the admin feed.
- **Eval harness** — extraction accuracy, ICD precision/recall, faithfulness (no
  hallucinated meds/findings), and redaction recall, scored against a synthetic gold set.
- **Schema-isolated multi-tenant DB** — all tables live in a dedicated `charted` Postgres
  schema, so the app can safely share a database with other projects.

## The AI pipeline

```
audio ─▶ Whisper ─▶ demographics (deterministic) ─▶ PHI redaction ─▶ speaker labels
                                                                          │
                                          gpt-4o-mini structured output ◀─┘
                                                    │
                                          Zod validate (retry on fail)
                                                    │
                                    store as note v1 (source = "ai")
                                                    │
                        clinician edits ─▶ new version (source = "clinician")
                                                    │
                                  approve ─▶ status = approved + audit entry
```

This is a **transform pipeline, not RAG** — no vector store, no embeddings. The
demographics step runs *before* redaction so PHI can be both extracted for the header
and masked from the model input in one pass.

| Concern | Approach |
|---|---|
| **Transcription** | OpenAI `whisper-1` returns text + duration; the duration is audited per visit. |
| **Speaker diarization** | A best-effort labeling pass tags turns as Doctor/Patient; on failure it falls back to the unlabeled transcript rather than blocking the pipeline. |
| **Structured generation** | `gpt-4o-mini` at `temperature: 0.2` with a strict Zod-derived response schema (`chiefComplaint`, full SOAP, `medications`, `allergies`, `vitals`, `icdCodes`, `flags`). |
| **Schema enforcement** | `zodResponseFormat` sends the JSON schema to the model; the response is then re-parsed with `SoapNote.safeParse` and **retried once** on validation failure before erroring. |
| **Anti-hallucination prompt** | The system prompt forbids inventing findings/meds, requires `null` for unstated vitals, and requires each ICD-10 suggestion to carry a confidence score + one-line rationale. |
| **Caching** | Structuring results are cached by redacted-transcript content to avoid re-billing identical inputs. |
| **Faithfulness eval** | A scoring pass flags any medication/finding in the note that is not supported by the transcript. |

The SOAP schema lives in [`soap.ts`](charted-backend/src/schema/soap.ts); the
structuring call and the nullable-vitals fix are in
[`structure.ts`](charted-backend/src/pipeline/structure.ts); the orchestration is in
[`run.ts`](charted-backend/src/pipeline/run.ts).

## Architecture (deployed)

```
Browser
  │ HTTPS
  ▼
Netlify (Next.js frontend) ──HTTPS──► EC2 (Ubuntu)
                                       ├─ Caddy container  (:443, automatic TLS)
                                       └─ backend container (:8080, Node API)
                                              │ SSL
                                              ▼
                                        Neon (managed Postgres)
```

The backend is containerized (Docker Compose: API + Caddy). **GitHub Actions** runs
tests + typecheck on every push to `main` and auto-deploys: Netlify rebuilds the
frontend, and the EC2 box pulls the latest code and rebuilds/restarts the containers.

## Tech stack

| Layer | Choice |
|---|---|
| Frontend | Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS, TanStack Query, lucide-react |
| Backend | Node 20, TypeScript, Express 4, Zod, Multer (uploads), `pg` |
| Auth | JWT (`jsonwebtoken`), `bcryptjs`, role-based middleware |
| AI | OpenAI `whisper-1` (transcribe), `gpt-4o-mini` (structured output), `tts-1` (synthetic test audio) |
| Database | PostgreSQL (Neon, managed) — app tables namespaced under a `charted` schema |
| Infra | Docker Compose, Caddy (auto-HTTPS), AWS EC2, Netlify, GitHub Actions |
| Testing | Vitest (unit + integration), custom eval harness |

## API

**Auth**

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/auth/register` | create an account (patient/doctor) → JWT |
| POST | `/api/auth/login`    | sign in → JWT (rejects deactivated accounts) |
| GET  | `/api/auth/me`       | current user |

**Doctors**

| Method | Path | Purpose |
|---|---|---|
| GET            | `/api/doctors`    | browse the doctor directory |
| GET/POST/PATCH | `/api/doctors/me` | a doctor manages their own profile |

**Appointments**

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/appointments`             | patient books (`PENDING`) |
| GET  | `/api/appointments`             | role-aware list |
| GET  | `/api/appointments/:id`         | one appointment (participant/admin) |
| POST | `/api/appointments/:id/confirm` · `/reject` | assigned doctor decides |
| POST | `/api/appointments/:id/cancel`  | participant cancels |
| POST | `/api/appointments/:id/start`   | **the bridge** — creates a visit, runs the scribe, marks `COMPLETED` |

**Visits (the scribe)**

| Method | Path | Purpose |
|---|---|---|
| POST  | `/api/visits`             | multipart `audio` **or** JSON `{ transcript }` → run pipeline |
| GET   | `/api/visits`             | list visits |
| GET   | `/api/visits/:id`         | visit + redacted transcript + latest note |
| PATCH | `/api/visits/:id/note`    | clinician edit → new version (does **not** finalize) |
| POST  | `/api/visits/:id/approve` | the **only** route that finalizes |
| GET   | `/api/visits/:id/versions`| version history + audit trail |

**Prescriptions / Patients / Admin**

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/prescriptions`            | issue from an approved visit (meds auto-seed from the note) |
| GET  | `/api/prescriptions` · `/:id`   | role-aware list / one |
| GET  | `/api/patients`                 | patient directory (doctor/admin) |
| GET  | `/api/patients/:id/history`     | full patient chart + timeline (`:id` may be `me`) |
| GET  | `/api/admin/users` · `/:id`     | user directory (admin) |
| PATCH| `/api/admin/users/:id/role` · `/status` | change role / activate-deactivate |
| GET  | `/api/admin/stats` · `/audit`   | dashboard counts + activity feed |
| GET  | `/api/health`                   | liveness + DB/model status |

## Repo layout

```
charted-backend/    Express API, transform pipeline, Zod schema, eval harness, Dockerfile
charted-frontend/   Next.js app (auth, sidebar shell, role-based pages)
test-recordings/    Synthetic audio samples (.mp3) for manual testing
Caddyfile           Reverse proxy + automatic TLS config
docker-compose.yml  Backend + Caddy services
.github/workflows/  CI/CD (test, typecheck, deploy)
sr.mp4              Demo walkthrough recording (not committed by default — see below)
```

Backend internals:

```
charted-backend/src/
  pipeline/    transcribe · demographics · redact · diarize · structure · run
  schema/      soap.ts (Zod SOAP + ICD schema, the source of truth)
  routes/      auth · doctors · appointments · visits · prescriptions · patients · admin · health
  lib/         auth (JWT + bcrypt) · requireAuth (RBAC) · openai · cache · audit · rateLimit · cors
  db/          pool · schema.sql · users · doctors · appointments · prescriptions · stats · queries · init
  eval/        synth (gold-set generation) · run-eval · score · faithfulness
```

Frontend internals:

```
charted-frontend/
  app/         login · register · appointments · doctors · prescriptions · patients · me · admin · visits/[id] · new
  components/  Sidebar · AppShell (auth guard) · PatientChart · TranscriptPane · SoapEditor · …
  lib/         api (token-aware fetch) · auth (React context) · hooks (TanStack Query)
```

## Run it locally

**Backend**
```bash
cd charted-backend
npm install
cp .env.example .env        # set OPENAI_API_KEY, DATABASE_URL, JWT_SECRET
npm run db:init             # creates the `charted` schema + all tables
npm run dev                 # http://localhost:8080
npm test                    # unit + integration tests (Vitest)
npm run synth && npm run eval   # generate gold set + score the pipeline
```

**Frontend**
```bash
cd charted-frontend
npm install
cp .env.local.example .env.local   # NEXT_PUBLIC_API_URL=http://localhost:8080
npm run dev                 # http://localhost:3000
```

**Make an admin** — registration only creates patients/doctors, so promote one account once:
```sql
update charted.users set role = 'ADMIN' where lower(email) = lower('you@example.com');
```
Then log out / log in to get a fresh token carrying the admin role.

Sample synthetic audio for manual testing lives in [`test-recordings/`](test-recordings/).

## Safety backstops

- PHI redaction runs **before** any model call; demographics are extracted without a model.
- The AI output is always a **draft**; only `POST /approve` flips status to approved, and
  prescriptions can only be issued from an approved note.
- Faithfulness check flags any med/finding not present in the transcript.
- Schema validation with one retry; the request fails loudly rather than storing garbage.
- JWT auth + role gates on every route; deactivated accounts can't sign in.
- Rate limiting on write routes. **Synthetic data only.**

## Demo recording

A full screen recording of the workflow lives at [`sr.mp4`](sr.mp4): a visit is
created, audio is transcribed and structured into a SOAP note, the clinician reviews
the AI draft side-by-side with the transcript, edits a section (creating a new
version), and approves the note.

> The raw recording is ~92 MB and is **not** committed to git by default (GitHub warns
> above 50 MB / blocks above 100 MB). To share it, upload it as a GitHub Release asset,
> host it externally and link it here, or track it with [Git LFS](https://git-lfs.com/).

---

<sub>Built as a portfolio project to demonstrate production-shaped AI engineering:
constrained generation, PHI handling, human-in-the-loop review, evals, role-based access,
and full CI/CD deployment. Not for clinical use.</sub>
