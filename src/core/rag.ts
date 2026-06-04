import OpenAI from "openai";
import fs from "fs";
import path from "path";
import { DatabaseClient, MessageEmbedding, NoteEmbedding } from "../db/sqlite";

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

export async function embedText(text: string): Promise<number[]> {
  const client = getClient();
  const res = await withTimeout(
    client.embeddings.create({
      model: "text-embedding-3-small",
      input: text,
    }),
    12000,
    "Embedding request"
  );
  const embedding = res.data?.[0]?.embedding;
  if (!embedding) {
    throw new Error("No embedding returned");
  }
  return embedding;
}

export async function indexMessage(
  db: DatabaseClient,
  messageId: number,
  text: string
): Promise<void> {
  try {
    const vector = await embedText(text);
    db.upsertMessageEmbedding({ messageId, vector });
  } catch (err) {
    console.error(
      `[rag] Failed to index message ${messageId}: ${
        err instanceof Error ? err.message : String(err)
      }`
    );
  }
}

export async function indexNote(
  db: DatabaseClient,
  notePath: string,
  content: string
): Promise<void> {
  try {
    const vector = await embedText(content);
    db.upsertNoteEmbedding({ path: notePath, vector });
  } catch (err) {
    console.error(
      `[rag] Failed to index note ${notePath}: ${
        err instanceof Error ? err.message : String(err)
      }`
    );
  }
}

function cosineSimilarity(a: number[], b: number[]): number {
  const minLen = Math.min(a.length, b.length);
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < minLen; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

async function loadNoteContent(notePath: string): Promise<string | null> {
  try {
    const content = await fs.promises.readFile(notePath, "utf8");
    return content;
  } catch {
    return null;
  }
}

export async function getRagContext(
  db: DatabaseClient,
  query: string,
  opts?: { limit?: number }
): Promise<string[]> {
  const limit = opts?.limit ?? 5;
  try {
    const queryEmbedding = await embedText(query);
    const messageEmbeddings: MessageEmbedding[] = db.listMessageEmbeddings();
    const noteEmbeddings: NoteEmbedding[] = db.listNoteEmbeddings();

    const scored: { snippet: string; score: number }[] = [];

    for (const m of messageEmbeddings) {
      const score = cosineSimilarity(queryEmbedding, m.embedding);
      if (m.text) {
        scored.push({ snippet: `Message: ${m.text}`, score });
      }
    }

    for (const n of noteEmbeddings) {
      const content = await loadNoteContent(n.path);
      if (!content) continue;
      const snippet = content.slice(0, 600);
      const score = cosineSimilarity(queryEmbedding, n.embedding);
      scored.push({ snippet: `Note (${path.basename(n.path)}): ${snippet}`, score });
    }

    return scored
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((s) => s.snippet);
  } catch (err) {
    console.error(
      `[rag] Failed to get context: ${err instanceof Error ? err.message : String(err)}`
    );
    return [];
  }
}
