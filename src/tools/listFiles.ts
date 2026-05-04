import fs from "fs";
import os from "os";
import path from "path";
import { ToolDefinition, ToolResult } from "./types";

export interface ListFilesArgs {
  path: string;
}

interface ListedFile {
  name: string;
  size: number;
  isDirectory: boolean;
}

function buildAllowlist(baseDir: string): string[] {
  return [
    path.resolve(baseDir),
    path.resolve(os.homedir(), "Downloads"),
    path.resolve(os.homedir(), "Documents"),
  ];
}

function isPathAllowed(targetPath: string, allowedRoots: string[]): boolean {
  const resolved = path.resolve(targetPath);
  return allowedRoots.some((root) => {
    const resolvedRoot = path.resolve(root);
    const relative = path.relative(resolvedRoot, resolved);
    return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
  });
}

async function runListFiles(
  dirPath: string,
  baseDir: string
): Promise<ToolResult<{ files: ListedFile[] }>> {
  if (!dirPath) {
    return { ok: false, message: "Path is required." };
  }

  const allowedRoots = buildAllowlist(baseDir);
  if (!isPathAllowed(dirPath, allowedRoots)) {
    return { ok: false, message: "Access to this path is not allowed." };
  }

  const resolved = path.resolve(dirPath);
  const stats = await fs.promises.stat(resolved);
  if (!stats.isDirectory()) {
    return { ok: false, message: "Path is not a directory." };
  }

  const entries = await fs.promises.readdir(resolved, { withFileTypes: true });
  const files: ListedFile[] = [];

  for (const entry of entries) {
    const entryPath = path.join(resolved, entry.name);
    const entryStats = await fs.promises.stat(entryPath);
    files.push({
      name: entry.name,
      size: entryStats.size,
      isDirectory: entry.isDirectory(),
    });
  }

  return { ok: true, data: { files } };
}

export const listFilesTool: ToolDefinition<ListFilesArgs> = {
  name: "listFiles",
  description:
    "List files in a directory, restricted to the Jarvis base directory or the user's Downloads/Documents folders.",
  parameters: {
    type: "object",
    properties: {
      path: { type: "string", description: "Directory path to list." },
    },
    required: ["path"],
  },
  handler: async (args, ctx) => {
    try {
      return await runListFiles(args.path, ctx.config.baseDir);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to list files.";
      ctx.logger?.error?.(`[tool] listFiles error: ${message}`);
      return { ok: false, message };
    }
  },
};
