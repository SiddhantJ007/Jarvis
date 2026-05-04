import OpenAI from "openai";
import { toFile } from "openai/uploads";

const SUPPORTED_TYPES = new Set(["audio/m4a", "audio/webm", "audio/wav", "audio/mp3", "audio/ogg"]);

function getClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not set");
  }
  return new OpenAI({ apiKey });
}

export async function transcribeAudio(buffer: Buffer, mimeType: string): Promise<string> {
  if (!SupportedMimeType(mimeType)) {
    throw new Error(`Unsupported audio mime type: ${mimeType}`);
  }

  try {
    const client = getClient();
    const file = await toFile(buffer, `audio.${mimeExtFromMime(mimeType)}`);
    const resp = await client.audio.transcriptions.create({
      file,
      model: "whisper-1",
      response_format: "text",
    });
    if (!resp) {
      throw new Error("No transcription returned");
    }
    return typeof resp === "string" ? resp : (resp as any).text || "";
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`STT transcription failed: ${message}`);
  }
}

function SupportedMimeType(mime: string): boolean {
  return SUPPORTED_TYPES.has(mime.toLowerCase());
}

function mimeExtFromMime(mime: string): string {
  if (mime.includes("m4a")) return "m4a";
  if (mime.includes("webm")) return "webm";
  if (mime.includes("wav")) return "wav";
  if (mime.includes("ogg")) return "ogg";
  if (mime.includes("mp3")) return "mp3";
  return "audio";
}
