import { describe, it, expect } from "vitest";
import { SoapNote } from "./soap";

const valid = {
  chiefComplaint: "Sore throat",
  subjective: "3 days of sore throat",
  objective: "Pharyngeal erythema",
  assessment: "Acute pharyngitis",
  plan: "Supportive care",
  medications: ["acetaminophen"],
  allergies: [],
  vitals: { tempC: 38.1, hr: 92, bp: "128/84" },
  icdCodes: [
    { code: "J02.9", description: "Acute pharyngitis", confidence: 0.8, rationale: "stated" },
  ],
  flags: [],
};

describe("SoapNote schema", () => {
  it("accepts a well-formed note", () => {
    expect(SoapNote.safeParse(valid).success).toBe(true);
  });

  it("rejects confidence outside 0..1", () => {
    const bad = { ...valid, icdCodes: [{ ...valid.icdCodes[0], confidence: 1.5 }] };
    expect(SoapNote.safeParse(bad).success).toBe(false);
  });

  it("rejects an unknown flag section", () => {
    const bad = { ...valid, flags: [{ section: "history", reason: "x" }] };
    expect(SoapNote.safeParse(bad).success).toBe(false);
  });

  it("requires nullable vitals to be present as keys", () => {
    const bad = { ...valid, vitals: { tempC: 38.1, hr: 92 } };
    expect(SoapNote.safeParse(bad).success).toBe(false);
  });
});
