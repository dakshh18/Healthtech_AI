# Charted — UI Design Prompt

Paste the block below into Claude (design/artifact mode), Stitch, v0, or any UI generator. It's written to produce the screens described in the frontend guide. Per-screen prompts and style notes follow if you want to generate one screen at a time.

---

## Master prompt (paste this)

```
Design a clean, trustworthy web UI for "Charted", an AI clinical scribe used by doctors.
The product turns a recorded doctor–patient conversation into a structured, editable
medical note (SOAP format) that the clinician reviews and approves. It is a
review-and-approve workspace, NOT a chatbot.

Design three desktop-first, responsive screens:

1) VISIT LIST (home)
   - A header with the app name "Charted" and a primary "New visit" button.
   - A list/grid of visit cards. Each card: synthetic patient reference (e.g. "Visit #SYN-0412"),
     date and duration, and a status badge — amber "Draft · needs review" or green "Approved".
   - Clicking a card opens the review screen.

2) REVIEW WORKSPACE (the core screen)
   - Top bar: visit reference + date + status badge on the left; a primary
     "Approve & finalize" button on the right that is DISABLED until the clinician
     confirms they've reviewed the note.
   - Below, a two-column layout:
     LEFT  — "Transcript" panel: the conversation with personal info masked as grey
             tags like [NAME] and [DATE]. Speaker labels "Dr" and "Pt".
     RIGHT — "SOAP note · editable" panel: four labelled, editable sections —
             S (Subjective), O (Objective), A (Assessment), P (Plan) — each with a small
             square letter tag. Any low-confidence section shows a small amber
             "low confidence — verify" pill.
             Below the sections: "Suggested ICD-10 codes" as chips, each showing a
             mono-font code (e.g. J02.9), a short description, a confidence percentage,
             and accept / reject controls.
   - The two panels sit side by side so the clinician can verify each note section
     against what was actually said.

3) VERSION HISTORY
   - A newest-first list of note versions, each tagged "AI draft" or "Clinician edit"
     with a timestamp and author. Selecting two versions shows a field-level diff
     (what the AI wrote vs what the clinician changed).

Visual style:
   - Calm, clinical, trustworthy. Light/white surfaces, generous whitespace,
     thin hairline borders, gentle rounded corners (8–12px). No gradients, no shadows,
     no neon. Flat and quiet.
   - ONE restrained primary accent (a calm blue or teal). Status colors: amber for
     "draft / verify", green for "approved", a soft warning tone for low-confidence.
   - Large, highly readable type. Sentence case everywhere, never ALL CAPS.
   - Must work in light and dark mode and meet accessibility contrast.
   - Use simple outline icons (microphone, file, check, clock) sparingly.

Tone the whole thing toward "a tool a busy doctor trusts" — fast to scan, obvious
where to look, and clear that nothing is final until a human approves it.
```

---

## Per-screen prompts (optional, generate one at a time)

**Review workspace only:**
```
Design the core screen of "Charted", an AI clinical scribe. Two-column desktop layout.
Top bar: "Visit #SYN-0412", date "Jun 3, 2026 · 4 min", an amber "Draft · needs review"
badge, and a disabled primary "Approve & finalize" button on the right.
Left column: a "Transcript (PHI masked)" card showing a doctor–patient dialogue with
"Dr"/"Pt" speaker labels and personal data shown as grey [NAME]/[DATE] tags.
Right column: a "SOAP note · editable" card with four editable sections each prefixed by
a small square letter tag S, O, A, P; the Assessment section shows an amber
"low confidence — verify" pill. Beneath: "Suggested ICD-10 codes" as chips — e.g.
"J02.9 Acute pharyngitis 92%" and "R50.9 Fever 71%" — each with accept/reject.
Calm clinical aesthetic: white surfaces, hairline borders, one blue/teal accent,
amber/green status colors, generous whitespace, light + dark mode, accessible contrast.
```

**New visit screen:**
```
Design the "New visit" screen for an AI clinical scribe. Centered card offering three
ways to start: (1) a large record button with a microphone icon and a live timer,
(2) an "Upload audio file" dropzone, (3) a "Paste transcript" text area for testing.
A primary "Create draft" button. After submitting, show a processing state: a skeleton
of the two-pane review layout with a subtle "transcribing… structuring…" status.
Same calm clinical style: light surfaces, one accent, hairline borders, sentence case.
```

---

## Style cheat-sheet (for porting into Tailwind)

- Surfaces: white / very light grey. Page background slightly darker than cards.
- Borders: 1px (or 0.5px) hairline, low-opacity neutral.
- Radius: `rounded-lg` (cards) / `rounded-md` (chips, buttons).
- Accent: one calm blue or teal for primary actions and the SOAP letter tags.
- Status: amber = draft/verify, green = approved, soft warning = low confidence.
- Type: large readable body, two weights (regular + medium). Sentence case only.
- No gradients, no drop shadows, no glow. Flat and calm — it's a medical tool.
- Always design the disabled "Approve" state — the human-in-the-loop gate is the point.
