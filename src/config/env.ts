import fs from "fs";
import os from "os";
import path from "path";
import dotenv from "dotenv";

dotenv.config();

export interface AppConfig {
  port: number;
  baseDir: string;
  dbPath: string;
  ttsStubEnabled: boolean;
  openaiApiKey?: string;
}

export function getConfig(): AppConfig {
  const port = Number(process.env.PORT || 3001);
  let baseDir =
    process.env.JARVIS_BASE_DIR ||
    path.join(os.homedir(), "Library", "Application Support", "Jarvis");

  // Ensure baseDir exists; if creation fails (permissions), fall back to a local data dir.
  try {
    if (!fs.existsSync(baseDir)) {
      fs.mkdirSync(baseDir, { recursive: true });
      console.log(`[config] Created base directory at ${baseDir}`);
    }
  } catch (err) {
    const fallback = path.join(process.cwd(), ".jarvis-data");
    try {
      if (!fs.existsSync(fallback)) {
        fs.mkdirSync(fallback, { recursive: true });
        console.log(
          `[config] Falling back to ${fallback} for data dir (original baseDir not writable: ${
            err instanceof Error ? err.message : String(err)
          })`
        );
      }
      baseDir = fallback;
    } catch (err2) {
      throw err2 instanceof Error ? err2 : new Error(String(err2));
    }
  }

  const dbPath = path.join(baseDir, "jarvis.db");
  const ttsStubEnabled =
    process.env.TTS_STUB === "1" || process.env.TTS_STUB === "true";
  const openaiApiKey = process.env.OPENAI_API_KEY || undefined;

  return { port, baseDir, dbPath, ttsStubEnabled, openaiApiKey };
}
