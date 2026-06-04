export function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// True if a meaningful word from `item` appears in an already-normalized
// haystack. Tolerates the dosage/format noise a note adds (e.g. the note says
// "Acetaminophen 500mg", the transcript just says "acetaminophen").
export function appearsIn(item: string, normalizedHaystack: string): boolean {
  const norm = normalize(item);
  if (!norm) return true;
  const words = norm.split(" ").filter((w) => w.length >= 4);
  if (words.length === 0) return normalizedHaystack.includes(norm);
  return words.some((w) => normalizedHaystack.includes(w));
}
