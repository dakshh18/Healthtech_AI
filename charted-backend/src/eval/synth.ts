import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { zodResponseFormat } from "openai/helpers/zod";
import { openai } from "../lib/openai";
import type { GoldCase } from "./types";

const here = path.dirname(fileURLToPath(import.meta.url));
const goldDir = path.join(here, "gold");

const COMPLAINTS = [
  "sore throat",
  "lower back pain",
  "urinary tract infection",
  "generalized anxiety",
  "ankle sprain",
  "seasonal allergic rhinitis",
  "acute bronchitis",
  "migraine headache",
];

const GoldGen = z.object({
  transcript: z.string(),
  expected: z.object({
    chiefComplaint: z.string(),
    medications: z.array(z.string()),
    allergies: z.array(z.string()),
    icdCodes: z.array(z.string()),
  }),
});

const SYSTEM = `You write realistic but SYNTHETIC primary-care consultation transcripts for testing a clinical scribe.
Rules:
- Output a natural doctor-patient dialogue ("Doctor:" / "Patient:") of 8-16 turns for the given chief complaint.
- Include vitals spoken aloud, any medications discussed (generic names), and any stated allergies.
- Do NOT include names, phone numbers, emails, dates, SSNs, or MRNs — leave all identifiers out.
- Also return the expected fields: chiefComplaint, medications, allergies, and the most appropriate ICD-10 code(s).
- Every medication and allergy you put in the expected fields MUST be spoken aloud somewhere in the transcript. Do not list expected items that the dialogue never mentions.`;

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

// Deterministic planted PHI per case so redaction recall is exactly measurable.
function plantedPhi(i: number) {
  const n = String(1000 + i);
  return {
    phone: `415-555-${n}`,
    email: `patient${i}@example.com`,
    dob: `0${(i % 9) + 1}/15/19${80 + i}`,
    ssn: `123-45-${n}`,
    mrn: `MRN: SYN${n}`,
  };
}

function phiLine(p: ReturnType<typeof plantedPhi>): string {
  return `Front desk: Confirming your details — phone ${p.phone}, email ${p.email}, date of birth ${p.dob}, SSN ${p.ssn}, ${p.mrn}.`;
}

async function generateOne(complaint: string, index: number): Promise<GoldCase> {
  const res = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.7,
    messages: [
      { role: "system", content: SYSTEM },
      { role: "user", content: `Chief complaint: ${complaint}` },
    ],
    response_format: zodResponseFormat(GoldGen, "gold_case"),
  });

  const gen = GoldGen.parse(JSON.parse(res.choices[0].message.content ?? "{}"));
  const p = plantedPhi(index);
  const transcript = `${phiLine(p)}\n${gen.transcript}`;

  return {
    id: `${slug(complaint)}-${String(index + 1).padStart(2, "0")}`,
    complaint,
    transcript,
    plantedPhi: [p.phone, p.email, p.dob, p.ssn, p.mrn],
    expected: gen.expected,
  };
}

async function writeAudio(c: GoldCase): Promise<void> {
  const res = await openai.audio.speech.create({
    model: "tts-1",
    voice: "alloy",
    input: c.transcript,
  });
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(path.join(goldDir, `${c.id}.mp3`), buf);
}

async function main() {
  const count = Number(process.argv[2] ?? 6);
  const withAudio = process.argv.includes("--audio");
  fs.mkdirSync(goldDir, { recursive: true });

  const complaints = COMPLAINTS.slice(0, Math.min(count, COMPLAINTS.length));
  for (let i = 0; i < complaints.length; i++) {
    const c = await generateOne(complaints[i], i);
    fs.writeFileSync(path.join(goldDir, `${c.id}.json`), JSON.stringify(c, null, 2));
    if (withAudio) await writeAudio(c);
    console.log(`generated ${c.id}${withAudio ? " (+audio)" : ""}`);
  }
  console.log(`\nWrote ${complaints.length} gold case(s) to ${goldDir}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
