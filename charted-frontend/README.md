# Charted — Frontend

The Next.js web app where a clinician records or uploads a consultation, watches
it become a structured draft, reviews it against the transcript, edits, and
approves. A review-and-approve workspace, not a chatbot — nothing finalizes
without a human.

## Stack

Next.js 14 (App Router) · TypeScript · Tailwind CSS · TanStack Query · browser
`MediaRecorder` for audio · `lucide-react` icons. Styling uses the Charted design
system (tokens + component classes ported into `app/globals.css`).

## Screens

- `/` — visit list with draft/approved status badges and search.
- `/new` — record (MediaRecorder), upload audio, or paste a transcript.
- `/visits/[id]` — the two-pane review workspace: redacted transcript (left),
  editable SOAP note + ICD chips (right). "Approve & finalize" is disabled until
  the note is saved and the clinician checks "I've reviewed this note".
- `/visits/[id]/history` — version history with field-level diffs between any
  two versions.

## Quick start

```bash
cd charted-frontend
npm install
cp .env.local.example .env.local   # NEXT_PUBLIC_API_URL=http://localhost:8080
npm run dev                        # UI on http://localhost:3000
```

The backend (`charted-backend`) must be running for data to load.

## Review state machine

`loading → reviewing → dirty → saving → reviewing`, and `reviewing → approvable`
once "I've reviewed this note" is checked. Only `approvable` enables approve;
after approval the note renders read-only with a finalized banner. This mirrors
the backend's approve-only-finalizes guarantee in the UI.
