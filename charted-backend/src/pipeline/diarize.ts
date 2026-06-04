import { z } from "zod";
import { zodResponseFormat } from "openai/helpers/zod";
import { openai } from "../lib/openai";

// Whisper returns unlabeled text. This labels each turn as doctor/patient so the
// UI can show speaker chips. It runs on the ALREADY-REDACTED transcript, so no
// PHI reaches the model. Verbatim — it only attributes speakers, never rewrites.

const Dialogue = z.object({
  turns: z.array(
    z.object({
      speaker: z.enum(["doctor", "patient"]),
      text: z.string(),
    })
  ),
});

const SYSTEM = `You label the speakers in a medical consultation transcript.
Split the text into turns and tag each as "doctor" or "patient".
Rules:
- Keep the wording exactly as written. Do not summarize, add, correct, or remove anything.
- The clinician asks the questions and explains the plan; the patient describes symptoms and answers.
- Preserve any [BRACKETED] redaction tags exactly as they appear.`;

export function hasSpeakerLabels(text: string): boolean {
  return /(^|\n)\s*(doctor|dr|physician|patient|pt)\s*:/i.test(text);
}

export async function labelSpeakers(redacted: string): Promise<string> {
  const res = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0,
    messages: [
      { role: "system", content: SYSTEM },
      { role: "user", content: redacted },
    ],
    response_format: zodResponseFormat(Dialogue, "dialogue"),
  });

  const parsed = Dialogue.safeParse(JSON.parse(res.choices[0].message.content ?? "{}"));
  if (!parsed.success || parsed.data.turns.length === 0) return redacted;

  return parsed.data.turns
    .map((t) => `${t.speaker === "doctor" ? "Doctor" : "Patient"}: ${t.text.trim()}`)
    .join("\n");
}
