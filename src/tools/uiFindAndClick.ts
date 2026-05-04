import { execFile } from "child_process";
import { promisify } from "util";
import { ToolDefinition, ToolResult } from "./types";

const execFileAsync = promisify(execFile);

async function runAppleScript(script: string, args: string[]): Promise<string> {
  const { stdout } = await execFileAsync("osascript", ["-l", "AppleScript", "-e", script, ...args]);
  return stdout.trim();
}

async function findAndClick(target: string, appName?: string): Promise<ToolResult<{ clicked: boolean }>> {
  if (process.platform !== "darwin") {
    return { ok: false, message: "uiFindAndClick is only supported on macOS." };
  }
  const needle = target.trim();
  if (!needle) return { ok: false, message: "Target cannot be empty." };

  const script = `
on run argv
  set needle to item 1 of argv
  set appName to ""
  if (count of argv) ≥ 2 then set appName to item 2 of argv
  set needleLower to needle as text
  tell application "System Events"
    if appName is "" then
      set proc to first application process whose frontmost is true
    else
      set proc to first application process whose name is appName
    end if
    repeat with w in windows of proc
      try
        set elems to entire contents of w
        repeat with el in elems
          try
            set ename to ""
            try
              set ename to name of el
            end try
            if ename is missing value then set ename to ""
            if ename is not "" then
              ignoring case
                if ename contains needleLower then
                  try
                    perform action "AXPress" of el
                    return "pressed"
                  end try
                  try
                    set pos to position of el
                    set sz to size of el
                    set cx to (item 1 of pos) + (item 1 of sz) / 2
                    set cy to (item 2 of pos) + (item 2 of sz) / 2
                    click at {cx, cy}
                    return "clicked"
                  end try
                end if
              end ignoring
            end if
          end try
        end repeat
      end try
    end repeat
  end tell
  return "notfound"
end run
  `.trim();

  const args = [needle];
  if (appName) args.push(appName);

  try {
    const result = await runAppleScript(script, args);
    if (result === "pressed" || result === "clicked") {
      return { ok: true, data: { clicked: true } };
    }
    return { ok: false, message: `Element containing "${needle}" not found.` };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, message };
  }
}

export interface UiFindAndClickArgs {
  target: string;
  appName?: string;
}

export const uiFindAndClickTool: ToolDefinition<UiFindAndClickArgs> = {
  name: "uiFindAndClick",
  description:
    "Find a UI element by name substring in the frontmost (or specified) app and click/press it. Requires macOS accessibility permission.",
  parameters: {
    type: "object",
    properties: {
      target: { type: "string", description: "Substring of the UI element name/label to click." },
      appName: { type: "string", description: "Optional app name; defaults to frontmost app." },
    },
    required: ["target"],
  },
  handler: async (args) => {
    return findAndClick(args.target, args.appName);
  },
};
