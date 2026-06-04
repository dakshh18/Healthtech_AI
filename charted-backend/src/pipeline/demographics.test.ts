import { describe, it, expect } from "vitest";
import { extractDemographics, maskDemographics } from "./demographics";

describe("extractDemographics", () => {
  it("pulls name, age (digits), phone and DOB", () => {
    const raw =
      "Patient: My name is Maria Gonzalez, I'm 47 years old. My phone is 415-555-0188 and my date of birth is 03/14/1979.";
    const d = extractDemographics(raw);
    expect(d.name).toBe("Maria Gonzalez");
    expect(d.age).toBe(47);
    expect(d.phone).toContain("415-555-0188");
    expect(d.dob).toBe("03/14/1979");
  });

  it("parses spelled-out ages and spoken dates", () => {
    const raw = "I'm John Smith, forty-seven years old, born March 3rd, 1979.";
    const d = extractDemographics(raw);
    expect(d.name).toBe("John Smith");
    expect(d.age).toBe(47);
    expect(d.dob).toMatch(/March 3rd, 1979/);
  });

  it("does not mistake 'I'm 47' phrasing for a name", () => {
    const d = extractDemographics("Doctor: how are you? Patient: I'm 52 and have a sore throat.");
    expect(d.name).toBeNull();
    expect(d.age).toBe(52);
  });

  it("does not treat 'I'm allergic to penicillin' as a name", () => {
    const d = extractDemographics("Patient: I'm allergic to penicillin.");
    expect(d.name).toBeNull();
  });

  it("returns nulls when nothing is present", () => {
    const d = extractDemographics("Doctor: what brings you in? Patient: my back hurts.");
    expect(d).toEqual({ name: null, age: null, sex: null, phone: null, dob: null });
  });

  it("masks the extracted name and DOB out of the transcript", () => {
    const demo = {
      name: "Maria Gonzalez",
      age: 47,
      sex: null,
      phone: null,
      dob: "March 3rd, 1979",
    };
    const masked = maskDemographics("Maria Gonzalez, born March 3rd, 1979, has a cough.", demo);
    expect(masked).not.toContain("Maria");
    expect(masked).not.toContain("March 3rd, 1979");
    expect(masked).toContain("[NAME]");
    expect(masked).toContain("[DATE]");
  });
});
