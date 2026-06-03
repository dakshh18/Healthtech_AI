// Deterministic PHI masking. Runs before any model call so the structuring
// model never sees raw identifiers. Redaction recall is measured in the eval.
const PATTERNS: [RegExp, string][] = [
  [/\b[\w.+-]+@[\w-]+\.[\w.-]+\b/g, "[EMAIL]"],
  [/\b\d{3}-\d{2}-\d{4}\b/g, "[SSN]"], // US SSN / similar 3-2-4 ids
  [/\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/g, "[PHONE]"],
  [/\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/g, "[DATE]"],
  [/\bMRN[:#]?\s*\w+\b/gi, "[MRN]"],
];

export function redact(raw: string): string {
  return PATTERNS.reduce((text, [re, tag]) => text.replace(re, tag), raw);
}
