import { z } from "zod";

export const IcdCode = z.object({
  code: z.string(),
  description: z.string(),
  confidence: z.number().min(0).max(1),
  rationale: z.string(),
});

export const Flag = z.object({
  section: z.enum(["subjective", "objective", "assessment", "plan"]),
  reason: z.string(),
});

export const SoapNote = z.object({
  chiefComplaint: z.string(),
  subjective: z.string(),
  objective: z.string(),
  assessment: z.string(),
  plan: z.string(),
  medications: z.array(z.string()),
  allergies: z.array(z.string()),
  vitals: z.object({
    tempC: z.number().nullable(),
    hr: z.number().nullable(),
    bp: z.string().nullable(),
  }),
  icdCodes: z.array(IcdCode),
  flags: z.array(Flag),
});

export type SoapNote = z.infer<typeof SoapNote>;
