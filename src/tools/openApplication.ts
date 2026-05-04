import fs from "fs";
import path from "path";
import { exec } from "child_process";
import { promisify } from "util";
import { ToolDefinition, ToolContext, ToolResult } from "./types";

const execAsync = promisify(exec);

const FILLER_WORDS = new Set([
  "again",
  "please",
  "now",
  "quick",
  "quickly",
  "right",
  "away",
  "up",
  "sir",
  "buddy",
  "bro",
  "thanks",
  "thank",
]);

const APP_NAME_ALIASES: Record<string, string> = {
  chrome: "Google Chrome",
  "google chrome": "Google Chrome",
  "g chrome": "Google Chrome",
  safari: "Safari",
  finder: "Finder",
  terminal: "Terminal",
  iterm: "iTerm",
  "iterm2": "iTerm",
  calendar: "Calendar",
  notes: "Notes",
  mail: "Mail",
  messages: "Messages",
  slack: "Slack",
  zoom: "zoom.us",
  figma: "Figma",
  calculator: "Calculator",
  calc: "Calculator",
  "app store": "App Store",
  photos: "Photos",
  music: "Music",
  spotify: "Spotify",
};

function cleanAppInput(name: string): string {
  let cleaned = name
    .replace(/[“”]/g, '"')
    .replace(/[’]/g, "'")
    .replace(/[.,!?;:]+$/g, "")
    .trim();

  const parts = cleaned
    .split(/\s+/)
    .map((p) => p.trim())
    .filter(Boolean);

  while (parts.length && FILLER_WORDS.has(parts[0].toLowerCase())) {
    parts.shift();
  }
  while (parts.length && FILLER_WORDS.has(parts[parts.length - 1].toLowerCase())) {
    parts.pop();
  }

  return parts.join(" ").trim();
}

function normalizeAppName(name: string): string {
  const trimmed = cleanAppInput(name);
  const alias = APP_NAME_ALIASES[trimmed.toLowerCase()];
  return alias || trimmed;
}

function sanitizeAppName(name: string): string {
  return name.replace(/"/g, '\\"');
}

function findApplicationPath(appName: string): string | null {
  const searchDirs = [
    "/Applications",
    "/Applications/Utilities",
    "/System/Applications",
    "/System/Applications/Utilities",
  ];

  const target = appName.toLowerCase().replace(/\.app$/, "");
  let partialMatch: string | null = null;

  for (const dir of searchDirs) {
    if (!fs.existsSync(dir)) continue;
    let entries: fs.Dirent[] = [];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (!entry.name.toLowerCase().endsWith(".app")) continue;
      const base = entry.name.slice(0, -4).toLowerCase();
      const fullPath = path.join(dir, entry.name);
      if (base === target) {
        return fullPath;
      }
      if (!partialMatch && base.includes(target)) {
        partialMatch = fullPath;
      }
    }
  }

  return partialMatch;
}

export interface OpenApplicationArgs {
  name: string;
}

async function runOpenApplication(
  appName: string,
  ctx: ToolContext
): Promise<ToolResult> {
  if (process.platform !== "darwin") {
    return { ok: false, message: "openApplication is only supported on macOS." };
  }

  const trimmed = normalizeAppName(appName);
  if (!trimmed) {
    return { ok: false, message: "Application name cannot be empty." };
  }

  const lowerName = trimmed.toLowerCase();
  const isChrome =
    lowerName === "google chrome" || lowerName === "chrome" || lowerName === "g chrome";

  try {
    const extraArgs = isChrome ? ' --args --remote-debugging-port=9222' : "";
    await execAsync(`open -a "${sanitizeAppName(trimmed)}"${extraArgs}`);
    ctx.logger?.log(`[tool] openApplication executed for "${trimmed}"`);
    return { ok: true, data: { opened: trimmed } };
  } catch (error) {
    // Try locating the .app bundle directly as a fallback (helps with partial names like "calc").
    const foundPath = findApplicationPath(trimmed);
    if (foundPath) {
      try {
        await execAsync(`open "${sanitizeAppName(foundPath)}"`);
        ctx.logger?.log(
          `[tool] openApplication fallback path for "${trimmed}" -> ${foundPath}`
        );
        return { ok: true, data: { opened: foundPath } };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        ctx.logger?.error(
          `[tool] openApplication path open failed for "${foundPath}": ${message}`
        );
      }
    }

    const message =
      error instanceof Error ? error.message : "Failed to open application.";
    ctx.logger?.error(
      `[tool] openApplication error for "${trimmed}": ${message}`
    );
    return {
      ok: false,
      message: `Could not open "${trimmed}". ${message}`,
    };
  }
}

export const openApplicationTool: ToolDefinition<OpenApplicationArgs> = {
  name: "openApplication",
  description: "Open a macOS application by name using the 'open -a' command.",
  parameters: {
    type: "object",
    properties: {
      name: {
        type: "string",
        description: "Name of the application to open (as shown in Finder).",
      },
    },
    required: ["name"],
  },
  handler: async (args, ctx) => {
    return runOpenApplication(args.name, ctx);
  },
};
