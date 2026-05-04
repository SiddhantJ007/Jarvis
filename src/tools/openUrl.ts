import { exec } from "child_process";
import { promisify } from "util";
import { ToolDefinition, ToolContext, ToolResult } from "./types";

const execAsync = promisify(exec);

export interface OpenUrlArgs {
  url: string;
}

async function runOpenUrl(url: string, ctx: ToolContext): Promise<ToolResult> {
  const trimmed = (url || "").trim();
  if (!trimmed) {
    return { ok: false, message: "URL cannot be empty." };
  }

  try {
    await execAsync(`open "${trimmed.replace(/"/g, '\\"')}"`);
    ctx.logger?.log?.(`[tool] openUrl executed for "${trimmed}"`);
    return { ok: true, data: { opened: trimmed } };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to open URL.";
    ctx.logger?.error?.(`[tool] openUrl error: ${message}`);
    return { ok: false, message };
  }
}

export const openUrlTool: ToolDefinition<OpenUrlArgs> = {
  name: "openUrl",
  description: "Open a URL in the default browser using the macOS 'open' command.",
  parameters: {
    type: "object",
    properties: {
      url: {
        type: "string",
        description: "URL to open.",
      },
    },
    required: ["url"],
  },
  handler: async (args, ctx) => {
    return runOpenUrl(args.url, ctx);
  },
};
