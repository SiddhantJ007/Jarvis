import { execFile } from "child_process";
import { promisify } from "util";
import { ToolDefinition, ToolResult } from "./types";

const execFileAsync = promisify(execFile);

type Direction = "up" | "down";

async function runAppleScript(script: string, args: string[]): Promise<string> {
  const { stdout } = await execFileAsync("osascript", ["-l", "AppleScript", "-e", script, ...args]);
  return stdout.trim();
}

async function scroll(direction: Direction, steps: number, appName?: string): Promise<ToolResult<{ scrolled: boolean }>> {
  if (process.platform !== "darwin") {
    return { ok: false, message: "uiScroll is only supported on macOS." };
  }
  const keyCode = direction === "down" ? "125" : "126"; // arrow down/up
  const script = `
on run argv
  set keyCode to item 1 of argv as integer
  set iterations to item 2 of argv as integer
  set appName to ""
  if (count of argv) ≥ 3 then set appName to item 3 of argv
  if appName is not "" then
    tell application appName to activate
    delay 0.1
  end if
  tell application "System Events"
    repeat iterations times
      key code keyCode
      delay 0.02
    end repeat
  end tell
  return "done"
end run
  `.trim();

  const args = [keyCode, Math.max(1, Math.min(steps, 50)).toString()];
  if (appName) args.push(appName);

  try {
    const result = await runAppleScript(script, args);
    return { ok: result === "done", data: { scrolled: result === "done" } };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, message };
  }
}

export interface UiScrollArgs {
  direction: Direction;
  steps?: number;
  appName?: string;
}

export const uiScrollTool: ToolDefinition<UiScrollArgs> = {
  name: "uiScroll",
  description:
    "Scrolls the frontmost (or specified) app using arrow key presses. Requires accessibility permission.",
  parameters: {
    type: "object",
    properties: {
      direction: { type: "string", description: "Scroll direction: up or down." },
      steps: { type: "number", description: "How many arrow key presses (1-50). Default 5." },
      appName: { type: "string", description: "Optional app to focus; defaults to frontmost." },
    },
    required: ["direction"],
  },
  handler: async (args) => {
    const steps = args.steps ?? 5;
    const dir = args.direction === "up" ? "up" : "down";
    return scroll(dir, steps, args.appName);
  },
};
