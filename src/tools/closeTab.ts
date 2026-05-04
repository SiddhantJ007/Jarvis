import { execFile } from "child_process";
import { promisify } from "util";
import { ToolDefinition, ToolResult } from "./types";

const execFileAsync = promisify(execFile);

export const closeTabTool: ToolDefinition<{ appName?: string }> = {
  name: "closeTab",
  description: "Close the frontmost tab in Chrome (or specified browser) via AppleScript (Cmd+W).",
  parameters: {
    type: "object",
    properties: {
      appName: { type: "string", description: "Browser app name; default Google Chrome." },
    },
    required: [],
  },
  handler: async (args): Promise<ToolResult<{ closed: boolean }>> => {
    const appName = args.appName?.trim() || "Google Chrome";
    const script = `
on run argv
  set targetApp to "${appName}"
  tell application targetApp
    activate
    tell application "System Events"
      keystroke "w" using command down
    end tell
  end tell
  return "closed"
end run
    `.trim();
    try {
      const { stdout } = await execFileAsync("osascript", ["-l", "AppleScript", "-e", script]);
      return { ok: stdout.trim() === "closed", data: { closed: true } };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { ok: false, message };
    }
  },
};
