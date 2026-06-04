import { normalize, appearsIn } from "./text";
import { redact } from "../pipeline/redact";

// Chief complaint is free text, so we don't demand an exact string. It matches
// if the expected phrase appears, or a majority of its meaningful words do
// (phrasing varies, e.g. expected "generalized anxiety" vs note "Anxiety").
export function complaintMatch(predicted: string, expected: string): boolean {
  const p = normalize(predicted);
  const e = normalize(expected);
  if (!e) return true;
  if (p.includes(e)) return true;
  const words = e.split(" ").filter((w) => w.length >= 4);
  if (words.length === 0) return p.includes(e);
  const hits = words.filter((w) => p.includes(w)).length;
  return hits / words.length >= 0.5;
}

// Fraction of expected list items that show up somewhere in the predicted list.
export function listRecall(predicted: string[], expected: string[]): number {
  if (expected.length === 0) return 1;
  const hay = normalize(predicted.join(" ; "));
  const found = expected.filter((e) => appearsIn(e, hay));
  return found.length / expected.length;
}

const normCode = (c: string) => c.toUpperCase().replace(/\s/g, "");

export function icdCounts(predicted: string[], expected: string[]) {
  const exp = new Set(expected.map(normCode));
  const pred = predicted.map(normCode);
  const tp = pred.filter((c) => exp.has(c)).length;
  return { tp, pred: pred.length, exp: exp.size };
}

export function redactionRecall(planted: string[], raw: string) {
  const redacted = redact(raw);
  const masked = planted.filter((p) => !redacted.includes(p)).length;
  return { masked, total: planted.length };
}
