import OpenAI from "openai";

function getClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not set");
  }
  return new OpenAI({ apiKey });
}

export async function synthesizeSpeech(text: string): Promise<string | null> {
  if (process.env.TTS_DISABLED === "1") {
    return null;
  }

  // Use a single default voice (onyx) unless TTS_VOICE overrides it.
  const voice = process.env.TTS_VOICE || "onyx";

  try {
    const client = getClient();
    const result = await client.audio.speech.create({
      model: "tts-1",
      voice,
      input: text,
      response_format: "mp3",
    });
    const audioBuffer = Buffer.from(await result.arrayBuffer());
    return audioBuffer.toString("base64");
  } catch (err) {
    console.error(
      `[tts] Failed to synthesize speech: ${err instanceof Error ? err.message : String(err)}`
    );
    return null;
  }
}
