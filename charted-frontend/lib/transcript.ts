export type Speaker = "dr" | "pt" | null;
export type Turn = { speaker: Speaker; text: string };

const SPEAKER_RE = /^(doctor|dr|physician|provider|patient|pt|front desk|receptionist)\s*[:\-]\s*/i;

function speakerOf(label: string): Speaker {
  const l = label.toLowerCase();
  if (l.startsWith("d") || l === "physician" || l === "provider") return "dr";
  if (l === "patient" || l === "pt") return "pt";
  return null; // front desk / receptionist / unknown -> neutral
}

// Splits a redacted transcript into speaker turns. Falls back to a single
// neutral block when no "Doctor:/Patient:" markers are present.
export function parseTranscript(raw: string): Turn[] {
  const text = raw.trim();
  if (!text) return [];

  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const turns: Turn[] = [];

  for (const line of lines) {
    const m = line.match(SPEAKER_RE);
    if (m) {
      turns.push({ speaker: speakerOf(m[1]), text: line.slice(m[0].length).trim() });
    } else if (turns.length > 0) {
      turns[turns.length - 1].text += ` ${line}`;
    } else {
      turns.push({ speaker: null, text: line });
    }
  }

  // If a transcript is one long line with inline markers, split on them instead.
  if (turns.length === 1 && SPEAKER_RE.test(turns[0].text) === false) {
    const parts = text
      .split(/(?=(?:doctor|dr|physician|provider|patient|pt|front desk|receptionist)\s*[:\-])/i)
      .map((s) => s.trim())
      .filter(Boolean);
    if (parts.length > 1) {
      return parts.map((p) => {
        const m = p.match(SPEAKER_RE);
        return m
          ? { speaker: speakerOf(m[1]), text: p.slice(m[0].length).trim() }
          : { speaker: null as Speaker, text: p };
      });
    }
  }

  return turns;
}

// Splits text around PHI mask tags like [DATE] / [PHONE] for chip rendering.
export function splitMasks(text: string): { value: string; mask: boolean }[] {
  return text
    .split(/(\[[A-Z_]+\])/g)
    .filter((s) => s.length > 0)
    .map((s) => ({ value: s, mask: /^\[[A-Z_]+\]$/.test(s) }));
}
