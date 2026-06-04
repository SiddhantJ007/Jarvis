import OpenAI from "openai";

function getClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not set");
  }
  return new OpenAI({ apiKey, timeout: 12000, maxRetries: 1 });
}

async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timeout: NodeJS.Timeout | undefined;
  const timer = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
  });
  try {
    return await Promise.race([promise, timer]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

export async function synthesizeSpeech(text: string): Promise<string | null> {
  if (process.env.TTS_DISABLED === "1") {
    return null;
  }
  if (!text.trim()) {
    return null;
  }

  // Use a single default voice (onyx) unless TTS_VOICE overrides it.
  const voice = process.env.TTS_VOICE || "onyx";

  try {
    const client = getClient();
    const result = await withTimeout(
      client.audio.speech.create({
        model: "tts-1",
        voice,
        input: text,
        response_format: "mp3",
      }),
      12000,
      "TTS request"
    );
    const audioBuffer = Buffer.from(await result.arrayBuffer());
    return audioBuffer.toString("base64");
  } catch (err) {
    console.error(
      `[tts] Failed to synthesize speech: ${err instanceof Error ? err.message : String(err)}`
    );
    return null;
  }
}
