# Charted — Frontend Build Guide

> The Next.js web app where a clinician records or uploads a consultation, watches it become a structured draft, **reviews it against the transcript**, edits, and approves. Not a chatbot — a review-and-approve workspace.

---

## 1. What it renders

Three small screens:

1. **New visit** (`/new`) — record audio in the browser, upload a file, or paste a transcript (v1).
2. **Review** (`/visits/[id]`) — the core two-pane screen: transcript on the left, editable SOAP note + ICD chips on the right, an approve button that's the only way to finalize.
3. **History** (`/visits/[id]/history`) — every version (AI draft + clinician edits) with timestamps. The audit log, made visible.

Plus the home list (`/`) showing visits with draft/approved status.

## 2. Tech stack

| Layer | Choice |
|---|---|
| Framework | Next.js 14 (App Router), TypeScript |
| Styling | Tailwind CSS |
| Server state | TanStack Query |
| Audio capture | Browser `MediaRecorder` API (no native code) |
| Markdown/diff | `react-markdown`, a small diff lib for history |

No mobile/native needed. A recruiter clicks the link and tries it — that's the win.

## 3. Folder structure

```
charted-frontend/
├── app/
│   ├── layout.tsx              QueryClientProvider + shell
│   ├── page.tsx                visit list
│   ├── new/page.tsx            record / upload / paste
│   └── visits/[id]/
│       ├── page.tsx            review workspace
│       └── history/page.tsx    version history
├── components/
│   ├── VisitList.tsx
│   ├── VisitCard.tsx           status badge + meta
│   ├── AudioRecorder.tsx       MediaRecorder wrapper
│   ├── TranscriptPaste.tsx     v1 entry path
│   ├── ReviewWorkspace.tsx     two-pane container + state machine
│   ├── TranscriptPane.tsx      left pane (redacted transcript)
│   ├── SoapEditor.tsx          editable S/O/A/P sections
│   ├── IcdChips.tsx            accept/reject code suggestions
│   ├── ConfidenceFlag.tsx      low-confidence marker
│   ├── ApproveBar.tsx          status + approve (gated)
│   └── VersionHistory.tsx      diff between versions
├── lib/
│   ├── api.ts                  fetch wrapper → backend
│   └── hooks.ts                useVisits, useVisit, useSaveNote, useApprove
├── types.ts                    mirror of the backend SoapNote type
├── .env.local.example
└── README.md
```

## 4. Data layer (`lib/hooks.ts`)

Thin TanStack Query hooks over the backend.

```ts
export const useVisit = (id: string) =>
  useQuery({ queryKey: ["visit", id], queryFn: () => api.get(`/api/visits/${id}`) });

export const useSaveNote = (id: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (soap: SoapNote) => api.patch(`/api/visits/${id}/note`, { soap }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["visit", id] }),
  });
};

export const useApprove = (id: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post(`/api/visits/${id}/approve`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["visit", id] }),
  });
};
```

## 5. The review workspace state machine

This drives the safety guarantee in the UI. The approve button is disabled until the clinician has actually engaged with the draft.

```
loading ──▶ reviewing ──(edit)──▶ dirty ──(save)──▶ reviewing
                │                                        │
                └────────────── (mark reviewed) ─────────┘
                                      │
                                  approvable ──(approve)──▶ approved (read-only)
```

- `dirty` while there are unsaved edits → "Save" enabled, "Approve" disabled.
- "Approve & finalize" only enables in `approvable` (saved + an explicit "I've reviewed this" check).
- After `approved`, the note renders read-only and the page shows a finalized banner.

```ts
type ReviewState =
  | "loading" | "reviewing" | "dirty" | "saving" | "approvable" | "approved";
```

## 6. The two-pane layout (`ReviewWorkspace.tsx`)

```tsx
<div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
  <TranscriptPane text={visit.transcript} />          {/* left: redacted transcript */}
  <div className="space-y-4">
    <SoapEditor soap={soap} onChange={setSoap} />       {/* right: editable S/O/A/P */}
    <IcdChips codes={soap.icdCodes} onToggle={toggle} />
  </div>
</div>
<ApproveBar state={state} onSave={save} onApprove={approve} />
```

- **Side by side on purpose**: the clinician verifies each note section against what was actually said. That's the trust mechanism.
- **Low-confidence flags** (`ConfidenceFlag`) render inline next to any section the backend flagged, so attention goes where it's needed.
- **ICD chips** show code, description, confidence, and accept/reject — that's the billing-completeness win.

## 7. Audio capture (`AudioRecorder.tsx`)

```tsx
const chunks = useRef<Blob[]>([]);
const start = async () => {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const rec = new MediaRecorder(stream);
  rec.ondataavailable = (e) => chunks.current.push(e.data);
  rec.onstop = () => {
    const blob = new Blob(chunks.current, { type: "audio/webm" });
    const fd = new FormData();
    fd.append("audio", blob, "visit.webm");
    api.postForm("/api/visits", fd);   // → pipeline kicks off
  };
  rec.start();
};
```

While the backend transcribes + structures, show a processing state (skeleton of the two panes). For v1, skip audio entirely and use `TranscriptPaste` → `POST /api/visits { transcript }`.

## 8. Visit list + history

- **List** (`/`): cards with patient ref, date, and a status badge (amber "Draft · needs review" vs green "Approved").
- **History** (`/visits/[id]/history`): list versions newest-first; selecting two shows a field-level diff (what the AI wrote vs what the clinician changed). This visualizes the audit log and is a strong "I think about traceability" signal.

## 9. Environment (`.env.local.example`)
```
NEXT_PUBLIC_API_URL=http://localhost:8080
```

## 10. Quick start
```bash
cd charted-frontend
npm install
cp .env.local.example .env.local
npm run dev                  # UI on http://localhost:3000
```

## 11. Suggested build order
1. **v1** — list + `/new` paste path + review workspace (read draft, edit, save, approve). Wire to backend v1.
2. **v2** — audio upload + processing state.
3. **v3** — in-browser `MediaRecorder` + version-history diff view.
4. **Polish** — keyboard shortcuts for accept/reject, PDF export button, empty/loading/error states.

## 12. Design notes
A clinical tool should feel calm and trustworthy: light surfaces, generous whitespace, one restrained accent color, clear status colors (amber = draft, green = approved, subtle warning for low-confidence), and large readable type. Use the paired design prompt to generate the look, then port it into Tailwind.
