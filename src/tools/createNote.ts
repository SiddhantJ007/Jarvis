import fs from "fs";
import path from "path";
import { ToolDefinition, ToolResult } from "./types";
import { indexNote } from "../core/rag";

export interface CreateNoteArgs {
  title?: string;
  content: string;
}

function toSafeFilename(title?: string): string {
  const fallback = `Note-${Date.now()}`;
  const base = (title || fallback).trim() || fallback;
  const slug = base
    .replace(/[^a-zA-Z0-9-_ ]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 80);
  return `${slug || fallback}.md`;
}

async function ensureDir(dir: string) {
  await fs.promises.mkdir(dir, { recursive: true });
}

async function runCreateNote(
  args: CreateNoteArgs,
  notesDir: string
): Promise<ToolResult<{ filePath: string; content: string }>> {
  const { title, content } = args;
  const trimmedContent = (content || "").trim();
  if (!trimmedContent) {
    return { ok: false, message: "Note content cannot be empty." };
  }

  await ensureDir(notesDir);
  const filename = toSafeFilename(title);
  const filePath = path.join(notesDir, filename);
  await fs.promises.writeFile(filePath, `${trimmedContent}\n`, "utf8");

  return { ok: true, data: { filePath, content: trimmedContent } };
}

export const createNoteTool: ToolDefinition<CreateNoteArgs> = {
  name: "createNote",
  description: "Create a markdown note under the Jarvis notes directory.",
  parameters: {
    type: "object",
    properties: {
      title: { type: "string", description: "Optional note title" },
      content: { type: "string", description: "Note content (markdown allowed)" },
    },
    required: ["content"],
  },
  handler: async (args, ctx) => {
    const notesDir = path.join(ctx.config.baseDir, "notes");
    try {
      const result = await runCreateNote(args, notesDir);
      if (result.ok && result.data?.filePath) {
        // Best-effort embedding index
        indexNote(ctx.db, result.data.filePath, result.data.content).catch(() => {
          ctx.logger?.error?.("[tool] Failed to index note for RAG");
        });
      }
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to create note.";
      ctx.logger?.error?.(`[tool] createNote error: ${message}`);
      return { ok: false, message };
    }
  },
};
