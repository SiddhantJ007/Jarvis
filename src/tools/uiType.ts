import { execFile } from "child_process";
import { promisify } from "util";
import { ToolDefinition, ToolResult } from "./types";

const execFileAsync = promisify(execFile);

async function runAppleScript(script: string, args: string[]): Promise<string> {
  const { stdout } = await execFileAsync("osascript", ["-l", "AppleScript", "-e", script, ...args]);
  return stdout.trim();
}

async function typeText(text: string, appName?: string): Promise<ToolResult<{ typed: boolean }>> {
  if (process.platform !== "darwin") {
    return { ok: false, message: "uiType is only supported on macOS." };
  }
  if (!text) {
    return { ok: false, message: "Text cannot be empty." };
  }

  const script = `
on run argv
  set typedText to item 1 of argv
  set appName to ""
  if (count of argv) > 1 then set appName to item 2 of argv
  if appName is not "" then
    tell application appName to activate
    delay 0.1
  end if
  tell application "System Events"
    keystroke typedText
  end tell
  return "typed"
end run
  `.trim();

  const args = [text];
  if (appName) args.push(appName);

  try {
    const result = await runAppleScript(script, args);
    return { ok: result === "typed", data: { typed: result === "typed" } };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, message };
  }
}

export interface UiTypeArgs {
  text: string;
  appName?: string;
}

export const uiTypeTool: ToolDefinition<UiTypeArgs> = {
  name: "uiType",
  description: "Types text into the frontmost app (or specified app) using System Events keystroke.",
  parameters: {
    type: "object",
    properties: {
      text: { type: "string", description: "Text to type." },
      appName: { type: "string", description: "Optional app name to target; defaults to frontmost app." },
    },
    required: ["text"],
  },
  handler: async (args) => {
    return typeText(args.text, args.appName);
  },
};
