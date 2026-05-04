import { execFile } from "child_process";
import { promisify } from "util";
import { ToolDefinition, ToolResult } from "./types";

const execFileAsync = promisify(execFile);

async function runAppleScript(script: string, args: string[]): Promise<string> {
  const { stdout } = await execFileAsync("osascript", ["-l", "AppleScript", "-e", script, ...args]);
  return stdout.trim();
}

async function clickByName(target: string, appName?: string): Promise<ToolResult<{ clicked: boolean }>> {
  if (process.platform !== "darwin") {
    return { ok: false, message: "uiClick is only supported on macOS." };
  }

  if (!target.trim()) {
    return { ok: false, message: "Target name cannot be empty." };
  }

  const script = `
on run argv
  set targetName to item 1 of argv
  set appName to ""
  if (count of argv) > 1 then set appName to item 2 of argv
  tell application "System Events"
    if appName is "" then
      set frontApp to first application process whose frontmost is true
    else
      set frontApp to first application process whose name is appName
    end if
    repeat with w in windows of frontApp
      try
        set elems to entire contents of w
        repeat with el in elems
          try
            if (exists name of el) then
              set n to name of el
              if n is not missing value then
                if n is equal to targetName then
                  try
                    perform action "AXPress" of el
                    return "pressed"
                  end try
                end if
              end if
            end if
          end try
        end repeat
      end try
    end repeat
  end tell
  return "notfound"
end run
  `.trim();

  const args = [target];
  if (appName) args.push(appName);

  try {
    const result = await runAppleScript(script, args);
    if (result === "pressed") {
      return { ok: true, data: { clicked: true } };
    }
    return { ok: false, message: `Element "${target}" not found.` };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, message };
  }
}

export interface UiClickArgs {
  target: string;
  appName?: string;
}

export const uiClickTool: ToolDefinition<UiClickArgs> = {
  name: "uiClick",
  description:
    "Click a UI element by its accessibility name/label in the frontmost app (or specified app). Requires macOS accessibility permission.",
  parameters: {
    type: "object",
    properties: {
      target: { type: "string", description: "Label/name of the UI element to click." },
      appName: { type: "string", description: "Optional app name to target; defaults to frontmost app." },
    },
    required: ["target"],
  },
  handler: async (args) => {
    return clickByName(args.target, args.appName);
  },
};
