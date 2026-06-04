import { describe, it, expect } from "vitest";
import { checkFaithfulness } from "./faithfulness";
import type { SoapNote } from "../schema/soap";

const base: SoapNote = {
  chiefComplaint: "Sore throat",
  subjective: "",
  objective: "",
  assessment: "",
  plan: "",
  medications: [],
  allergies: [],
  vitals: { tempC: null, hr: null, bp: null },
  icdCodes: [],
  flags: [],
};

describe("checkFaithfulness", () => {
  it("passes a med that appears in the transcript", () => {
    const soap = { ...base, medications: ["Ibuprofen 400mg"] };
    const r = checkFaithfulness(soap, "Doctor: take some ibuprofen for the pain.");
    expect(r.unsupported).toEqual([]);
    expect(r.score).toBe(1);
  });

  it("flags a hallucinated med not in the transcript", () => {
    const soap = { ...base, medications: ["Amoxicillin"] };
    const r = checkFaithfulness(soap, "Doctor: rest and fluids, no antibiotics needed.");
    expect(r.unsupported).toContain("Amoxicillin");
    expect(r.score).toBe(0);
  });

  it("checks allergies too", () => {
    const soap = { ...base, allergies: ["Penicillin"] };
    const r = checkFaithfulness(soap, "Patient: I am allergic to penicillin.");
    expect(r.score).toBe(1);
  });

  it("treats a note with no meds or allergies as faithful", () => {
    const r = checkFaithfulness(base, "any transcript");
    expect(r.checked).toBe(0);
    expect(r.score).toBe(1);
  });
});
