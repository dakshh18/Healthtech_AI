// Deterministic demographics extraction from the RAW transcript. Runs BEFORE
// redaction and uses no model, so the "no PHI ever reaches a model" guarantee
// holds. Whatever it finds is also masked out of the transcript the note model
// sees (see maskDemographics).

export type Demographics = {
  name: string | null;
  age: number | null;
  sex: "male" | "female" | null;
  phone: string | null;
  dob: string | null;
};

const NAME_STOPLIST = new Set([
  "Sure", "Okay", "Yes", "No", "Doctor", "Doc", "Hello", "Hi", "Good", "Thanks",
  "Thank", "Well", "So", "Right", "Patient", "Nurse",
]);

const ONES: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8,
  nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15,
  sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19,
};
const TENS: Record<string, number> = {
  twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90,
};

function wordsToNumber(phrase: string): number | null {
  const parts = phrase.toLowerCase().replace(/-/g, " ").split(/\s+/).filter(Boolean);
  let total = 0;
  let matched = false;
  for (const p of parts) {
    if (p in TENS) {
      total += TENS[p];
      matched = true;
    } else if (p in ONES) {
      total += ONES[p];
      matched = true;
    } else {
      return null;
    }
  }
  return matched ? total : null;
}

function extractName(raw: string): string | null {
  const re = /\b(?:my name is|i am|i'm|this is|name's|patient is)\s+([A-Za-z][A-Za-z'’-]*(?:\s+[A-Za-z][A-Za-z'’-]*){0,2})/i;
  const m = raw.match(re);
  if (!m) return null;
  const candidate = m[1].trim();
  const tokens = candidate.split(/\s+/);
  // Every token must be a capitalized proper noun. Without this, the
  // case-insensitive trigger would match phrases like "I'm allergic to ...".
  if (!tokens.every((t) => /^[A-Z][a-zA-Z'’-]*$/.test(t))) return null;
  if (NAME_STOPLIST.has(tokens[0])) return null;
  return candidate;
}

function extractAge(raw: string): number | null {
  const digit = raw.match(/\b(\d{1,3})[\s-]*(?:years?[\s-]*old|y\/?o\b)/i);
  if (digit) {
    const n = Number(digit[1]);
    if (n > 0 && n < 120) return n;
  }
  const explicit = raw.match(/\b(?:age[d]?|i'm|i am)\s+(\d{1,3})\b/i);
  if (explicit) {
    const n = Number(explicit[1]);
    if (n > 0 && n < 120) return n;
  }
  const words = raw.match(
    /\b((?:twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)(?:[\s-](?:one|two|three|four|five|six|seven|eight|nine))?|(?:ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen))\s+years?[\s-]*old/i
  );
  if (words) {
    const n = wordsToNumber(words[1]);
    if (n && n > 0 && n < 120) return n;
  }
  return null;
}

function extractSex(raw: string): "male" | "female" | null {
  const m = raw.match(/\byears?[\s-]*old\s+(male|female)\b/i) || raw.match(/\b(?:i'm|i am)\s+(?:a\s+)?(male|female)\b/i);
  if (m) return m[1].toLowerCase() as "male" | "female";
  return null;
}

function extractPhone(raw: string): string | null {
  const m = raw.match(/\+?\d[\d\s().-]{7,}\d/);
  if (!m) return null;
  const digits = m[0].replace(/\D/g, "");
  return digits.length >= 7 && digits.length <= 15 ? m[0].trim() : null;
}

const MONTHS = "January|February|March|April|May|June|July|August|September|October|November|December";

function extractDob(raw: string): string | null {
  const digit = raw.match(/\b\d{1,2}[/\-]\d{1,2}[/\-]\d{2,4}\b/);
  if (digit) return digit[0];
  const spoken = raw.match(new RegExp(`\\b(?:${MONTHS})\\s+\\d{1,2}(?:st|nd|rd|th)?,?\\s+\\d{4}\\b`, "i"));
  return spoken ? spoken[0] : null;
}

export function extractDemographics(raw: string): Demographics {
  return {
    name: extractName(raw),
    age: extractAge(raw),
    sex: extractSex(raw),
    phone: extractPhone(raw),
    dob: extractDob(raw),
  };
}

function maskAll(text: string, value: string, tag: string): string {
  const escaped = value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return text.replace(new RegExp(escaped, "gi"), tag);
}

// Mask the extracted identifiers in the (already regex-redacted) transcript so
// the note model never sees them. Name tokens are masked individually too, since
// the transcript may use a first name on its own later on.
export function maskDemographics(redacted: string, demo: Demographics): string {
  let out = redacted;
  if (demo.name) {
    out = maskAll(out, demo.name, "[NAME]");
    for (const token of demo.name.split(/\s+/)) {
      if (token.length > 2) out = maskAll(out, token, "[NAME]");
    }
  }
  if (demo.dob) out = maskAll(out, demo.dob, "[DATE]");
  if (demo.phone) out = maskAll(out, demo.phone, "[PHONE]");
  return out;
}
