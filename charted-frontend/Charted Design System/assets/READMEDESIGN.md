# Charted — Design System

**Charted** is an AI clinical scribe for doctors. It turns a recorded
doctor–patient conversation into a structured, editable **SOAP note** that the
clinician reviews and approves. It is a **review-and-approve workspace, not a
chatbot** — nothing is final until a human signs off.

The product is desktop-first and responsive, with three core surfaces:

1. **Visit list (home)** — a scannable list of visit cards, each with a synthetic
   patient reference, date, duration, and a status badge (amber "Draft · needs
   review" or green "Approved").
2. **Review workspace (the core screen)** — a two-column layout: the masked
   **Transcript** on the left, the editable **SOAP note** (S/O/A/P) plus
   suggested **ICD-10 codes** on the right. The primary "Approve & finalize"
   action stays **disabled until the clinician confirms they reviewed the note** —
   the human-in-the-loop gate is the whole point.
3. **Version history** — a newest-first list of note versions tagged "AI draft" or
   "Clinician edit", with field-level diffs between any two versions.

> **The feeling we're after:** a tool a busy doctor trusts. Fast to scan, obvious
> where to look, calm and quiet, and unmistakably clear that a human approves
> everything.

---

## Provenance & sources

This system was designed **from a written brief** — there was **no existing
codebase, Figma file, or prior brand** attached to the project. Everything here
(color, type, voice, components, UI kit) is an original system created to satisfy
the brief. If you later have a real Charted codebase or Figma, reconcile this
system against it; treat this as the canonical starting point until then.

**Font note (substitution flag):** the brief did not specify a typeface. I chose
**IBM Plex Sans** (UI) + **IBM Plex Mono** (codes/timestamps) — trustworthy,
technical, highly readable, and *not* an overused web font. They are loaded from
the **Google Fonts CDN** (no local `.ttf` files are vendored). If you have a
licensed brand face, swap the `--font-sans` / `--font-mono` tokens in
`colors_and_type.css` and self-host into `fonts/`.

---

## Content fundamentals

How Charted writes. The product is a medical tool; copy must lower cognitive load,
never add drama.

- **Voice:** calm, precise, factual. Like a good clinical colleague — competent
  and unfussy. Never salesy, never cute.
- **Casing:** **sentence case everywhere.** Buttons, labels, headings, badges.
  Never ALL CAPS (the only near-exception is the single-letter SOAP tags S/O/A/P
  and ICD-10 codes, which are inherent notation, not styling).
- **Person:** address the clinician as **"you"** sparingly; default to plain
  imperative labels. Buttons name the action ("Approve & finalize", "Create
  draft", "New visit"), not "Submit"/"OK".
- **AI humility:** the system never claims certainty it doesn't have. It says
  **"suggested"**, **"draft"**, **"low confidence — verify"**, **"AI draft"**.
  Confidence is always shown as a number the clinician can judge (e.g. "92%").
- **Status language:**
  - amber → `Draft · needs review`
  - green → `Approved`
  - low confidence → `low confidence — verify`
- **No emoji. No exclamation marks.** Tone is quiet. Punctuation is restrained;
  a middot ( · ) separates metadata (`Jun 3, 2026 · 4 min`).
- **PHI is masked, not hidden:** personal data appears as neutral grey tokens
  like `[NAME]`, `[DATE]`, `[AGE]` so the clinician understands what was said
  without exposing identity.
- **Numbers & codes** use the mono face and tabular figures so columns align.

**Examples (do):**
> New visit · Visit #SYN-0412 · Draft · needs review · Approve & finalize ·
> Suggested ICD-10 codes · low confidence — verify · AI draft · Clinician edit ·
> I've reviewed this note

**Don't:**
> "Submit!", "OOPS!", "Your note is READY 🎉", "Trust the AI", "100% accurate"

---

## Visual foundations

The aesthetic is **flat, clinical, and calm**. The design does its job by getting
out of the way.

- **Surfaces:** white cards on a slightly darker cool-grey page (`--surface` on
  `--bg`). Nested fills use `--surface-2`. No gradients, anywhere.
- **Borders:** **1px hairlines** in a low-contrast cool neutral (`--border`).
  Structure comes from hairlines and whitespace, **not** shadows. There are
  **no drop shadows** in the system — the only elevation cue is a hairline and a
  faint focus ring.
- **Color:** one restrained accent — a **clinical teal** (`--primary` `#0E7C8A`).
  It appears on primary buttons, the SOAP letter tags, links, focus rings, and
  the "AI draft" tag. Everything else is neutral until status demands color.
- **Status palette:** **amber** = draft / verify / low-confidence, **green** =
  approved, **red** = reject only. Status colors are always shown as a tinted
  subtle background + a readable text color + a hairline border (never a loud
  solid block).
- **Type:** IBM Plex Sans, two weights (regular 400 + medium 500), semibold 600
  reserved for rare emphasis. Large and readable — UI body 15px, transcript 16px,
  nothing structural below 12px. Mono for codes/timestamps.
- **Spacing:** generous. 4px base scale; cards breathe with 20–24px padding.
  Whitespace is the primary grouping tool.
- **Radii:** gentle. `--radius-lg` 12px for cards/panels, `--radius-md` 8px for
  buttons, `--radius-sm` 6px for chips/badges, pills for status.
- **Imagery:** essentially none. This is a text/data tool — no photography, no
  illustration, no decorative blobs. The only "image" is the logo mark.
- **Iconography:** sparse outline icons (Lucide, 2px stroke). Icons clarify
  actions (mic, file, check, clock); they never decorate.
- **Motion:** minimal and quick. 120–160ms ease transitions on hover/focus/press.
  No bounce, no parallax, no looping animation. The only ongoing motion is a
  recording timer and a subtle "transcribing…" shimmer during processing.
- **Hover / press states:** hover = a step up the surface scale (`--surface` →
  `--surface-2` → `--surface-3`) or `--primary` → `--primary-hover`; press = one
  step darker again. No scaling/transform on press for structural controls.
- **Focus:** a 2px `--primary` ring offset by the surface color (`--focus-ring`),
  always visible for keyboard users.
- **Cards:** white fill, 1px `--border`, 12px radius, no shadow. Interactive
  cards darken their border + fill slightly on hover (`.card-hover`).
- **Transparency / blur:** used almost never. Tinted status backgrounds are
  solid tokens, not alpha. No glassmorphism.
- **Dark mode:** a true cool-charcoal theme (not pure black). The teal brightens
  (`#2FB3C2`) for contrast; status tints become deep, desaturated washes. All
  text pairs target WCAG AA on their surface.

---

## Iconography

- **Set:** [Lucide](https://lucide.dev) — outline, 2px stroke, round caps/joins.
  Chosen for a calm, consistent, medical-neutral feel. It is **CDN-available**,
  so HTML files link it directly; a **curated subset is also vendored** as static
  SVGs in `assets/icons/` for offline/portable use.
- **Vendored icons** (`assets/icons/`): `mic`, `file-text`, `check`,
  `circle-check`, `clock`, `upload`, `x`, `chevron-right`, `search`, `plus`,
  `history`, `triangle-alert`, `shield-check`, `stethoscope`, `sparkles`,
  `pencil`, `play`, `pause`, `arrow-left`, `sun`, `moon`, `git-compare`.
- **Usage rules:** icons are **sparse and functional** — they label actions and
  status, never decorate. Default size 16–18px inline, inheriting `currentColor`.
  Pair an icon with a text label wherever space allows; icon-only controls
  (accept/reject) get an accessible label.
- **Emoji / unicode:** **never** used as icons or decoration. The only non-icon
  glyph is the middot ( · ) as a metadata separator.
- **Logo:** `assets/logo-mark.svg` (tile) and `assets/logo-wordmark.svg`
  (mark + "Charted"). The mark is a pulse line resolving into a check — signal in,
  reviewed out. Both use CSS vars so they theme automatically; pass concrete
  colors if rendering outside a themed page.

---

## Index — what's in this folder

| Path | What it is |
|---|---|
| `README.md` | This file — context, voice, visual foundations, iconography, index. |
| `SKILL.md` | Agent-Skills entry point (works in Claude Code). |
| `colors_and_type.css` | All design tokens: color (light+dark), type scale, spacing, radii, semantic classes. |
| `components.css` | Shared component styles (buttons, badges, pills, cards, SOAP tags, ICD chips, masks, diffs). |
| `assets/logo-mark.svg`, `assets/logo-wordmark.svg` | Brand marks. |
| `assets/icons/*.svg` | Vendored Lucide subset. |
| `preview/*.html` | Design-system specimen cards (color, type, spacing, components) shown in the Design System tab. |
| `ui_kits/charted/` | The Charted app UI kit — interactive recreation of all four screens (`index.html` + JSX components + its own README). |

**Start here:** open `ui_kits/charted/index.html` for the full clickable product,
or browse the specimen cards in the Design System tab.
