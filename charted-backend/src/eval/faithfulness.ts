import type { SoapNote } from "../schema/soap";
import { normalize, appearsIn } from "./text";

export type FaithfulnessResult = {
  score: number; // fraction of checked items grounded in the transcript
  checked: number;
  unsupported: string[];
};

// Checks that every medication and allergy in the note actually appears in the
// transcript. This is the core anti-hallucination guard: a med the model
// invented (not spoken in the visit) shows up here as unsupported.
export function checkFaithfulness(
  soap: SoapNote,
  transcript: string
): FaithfulnessResult {
  const haystack = normalize(transcript);
  const items = [...soap.medications, ...soap.allergies];
  const unsupported = items.filter((item) => !appearsIn(item, haystack));
  const checked = items.length;
  const score = checked === 0 ? 1 : (checked - unsupported.length) / checked;
  return { score, checked, unsupported };
}
