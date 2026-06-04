import { toFile } from "openai";
import { openai } from "../lib/openai";

export type Transcription = {
  text: string;
  durationSeconds: number | null;
};

// Transcribes an uploaded audio buffer. We use memory storage upstream, so we
// wrap the buffer with toFile rather than streaming from disk. verbose_json
// gives us the clip duration for audit/visit metadata.
export async function transcribe(
  buffer: Buffer,
  filename: string
): Promise<Transcription> {
  const file = await toFile(buffer, filename);
  const res = await openai.audio.transcriptions.create({
    model: "whisper-1",
    file,
    response_format: "verbose_json",
  });

  const duration = (res as { duration?: number }).duration;
  return { text: res.text, durationSeconds: duration ?? null };
}
