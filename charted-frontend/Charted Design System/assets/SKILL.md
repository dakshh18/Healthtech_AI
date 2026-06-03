---
name: charted-design
description: Use this skill to generate well-branded interfaces and assets for Charted (an AI clinical scribe for doctors), either for production or throwaway prototypes/mocks/etc. Contains essential design guidelines, colors, type, fonts, assets, and UI kit components for prototyping.
user-invocable: true
---

Read the `README.md` file within this skill, and explore the other available files.

If creating visual artifacts (slides, mocks, throwaway prototypes, etc), copy assets out and create static HTML files for the user to view. If working on production code, you can copy assets and read the rules here to become an expert in designing with this brand.

If the user invokes this skill without any other guidance, ask them what they want to build or design, ask some questions, and act as an expert designer who outputs HTML artifacts _or_ production code, depending on the need.

## Quick map
- `README.md` — context, content voice, visual foundations, iconography, file index. **Start here.**
- `colors_and_type.css` — all design tokens (color light+dark, type, spacing, radii) + semantic classes.
- `components.css` — buttons, badges, status pills, cards, SOAP/speaker tags, ICD chips, PHI masks, diffs.
- `assets/` — `logo-mark.svg`, `logo-wordmark.svg`, and `icons/` (vendored Lucide subset).
- `preview/` — specimen cards for every token and component.
- `ui_kits/charted/` — interactive recreation of the whole app (visit list, review workspace, version history, new visit) with reusable JSX primitives.

## Non-negotiables (the brand in one breath)
- Calm, clinical, trustworthy. Flat: **no gradients, no shadows** — structure from hairlines + whitespace.
- One accent: **clinical teal** (`--primary`). Status: amber = draft/verify, green = approved, soft amber = low confidence, red = reject only.
- **Sentence case everywhere.** No ALL CAPS, no emoji, no exclamation marks.
- Large, readable IBM Plex Sans; IBM Plex Mono for codes/timestamps. Sparse Lucide outline icons.
- The product is review-and-approve, never a chatbot. **Nothing is final until a human approves** — always design the disabled Approve state and AI-humility language ("suggested", "draft", "low confidence — verify").
- Must work in light and dark mode at accessible contrast.
