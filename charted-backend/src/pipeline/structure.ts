import { zodResponseFormat } from "openai/helpers/zod";
import { SoapNote } from "../schema/soap";
import { openai } from "../lib/openai";

// OpenAI structured-outputs strict mode ignores the OpenAPI `nullable: true`
// keyword that zodResponseFormat emits for `.nullable()` fields; it only treats
// a field as nullable when "null" is in the type union. Without this rewrite the
// model is forced to invent values (e.g. hr: 0) for vitals not in the transcript.
function allowNulls(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(allowNulls);
  if (node && typeof node === "object") {
    const obj = node as Record<string, unknown>;
    if (obj.nullable === true && typeof obj.type === "string") {
      obj.type = [obj.type, "null"];
      delete obj.nullable;
    }
    for (const key of Object.keys(obj)) obj[key] = allowNulls(obj[key]);
  }
  return node;
}

const responseFormat = zodResponseFormat(SoapNote, "soap_note");
allowNulls(responseFormat.json_schema.schema);

const SYSTEM = `You are a clinical documentation assistant. Convert the transcript into a SOAP note.
Rules:
- Use ONLY information present in the transcript. Never invent findings, meds, or history.
- If a section is unsupported or uncertain, fill it minimally and add a flag explaining why.
- For any vital not stated in the transcript, use null. Never guess or default to 0 or "".
- Suggest ICD-10 codes only when justified; include a confidence and a one-line rationale.`;

export async function structure(transcript: string): Promise<SoapNote> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.2,
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: transcript },
      ],
      response_format: responseFormat,
    });

    const content = res.choices[0].message.content ?? "{}";
    const parsed = SoapNote.safeParse(JSON.parse(content));
    if (parsed.success) return parsed.data;
  }
  throw new Error("Structuring failed schema validation after retries");
}
