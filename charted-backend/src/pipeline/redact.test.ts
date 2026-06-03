import { describe, it, expect } from "vitest";
import { redact } from "./redact";

describe("redact", () => {
  it("masks email, phone, date, SSN and MRN", () => {
    const raw =
      "Patient jane@example.com, phone 415-555-2671, DOB 03/14/1984, SSN 123-45-6789, MRN: A1B2C3.";
    const out = redact(raw);

    expect(out).toContain("[EMAIL]");
    expect(out).toContain("[PHONE]");
    expect(out).toContain("[DATE]");
    expect(out).toContain("[SSN]");
    expect(out).toContain("[MRN]");

    expect(out).not.toContain("jane@example.com");
    expect(out).not.toContain("415-555-2671");
    expect(out).not.toContain("123-45-6789");
  });

  it("leaves clinical text untouched", () => {
    const raw = "Temp 38.1C, HR 92, BP 128/84. Sore throat for 3 days.";
    expect(redact(raw)).toBe(raw);
  });
});
