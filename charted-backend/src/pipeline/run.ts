import { redact } from "./redact";
import { structure } from "./structure";
import { transcribe } from "./transcribe";
import { cached } from "../lib/cache";
import { writeAudit } from "../lib/audit";
import { saveTranscript, saveNoteVersion, setAudioSeconds } from "../db/queries";
import type { SoapNote } from "../schema/soap";

// Runs the transform pipeline for a transcript (text path): redact -> structure
// -> validate -> store as note version 1 (source "ai"). This never finalizes a
// visit; approval is a separate, explicit step.
export async function runPipeline(
  visitId: string,
  rawTranscript: string
): Promise<SoapNote> {
  const redacted = redact(rawTranscript);
  await saveTranscript(visitId, rawTranscript, redacted);

  const soap = await cached(redacted, () => structure(redacted));
  await saveNoteVersion(visitId, 1, soap, "ai");
  await writeAudit(visitId, "structured", "system", { flags: soap.flags.length });

  return soap;
}

// Audio path: transcribe with Whisper, then feed the same pipeline. Synchronous
// for v1 — we await the whole thing and return the note.
export async function runPipelineFromAudio(
  visitId: string,
  buffer: Buffer,
  filename: string
): Promise<SoapNote> {
  const { text, durationSeconds } = await transcribe(buffer, filename);
  await writeAudit(visitId, "transcribed", "system", { durationSeconds });
  if (durationSeconds != null) {
    await setAudioSeconds(visitId, Math.round(durationSeconds));
  }

  return runPipeline(visitId, text);
}
