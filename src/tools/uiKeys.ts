import { execFile } from "child_process";
import { promisify } from "util";
import { ToolDefinition, ToolResult } from "./types";

const execFileAsync = promisify(execFile);

type Modifier = "command" | "cmd" | "control" | "ctrl" | "option" | "alt" | "shift";

async function runAppleScript(script: string, args: string[]): Promise<string> {
  const { stdout } = await execFileAsync("osascript", ["-l", "AppleScript", "-e", script, ...args]);
  return stdout.trim();
}

async function pressKeys(args: UiKeysArgs): Promise<ToolResult<{ sent: boolean }>> {
  if (process.platform !== "darwin") {
    return { ok: false, message: "uiKeys is only supported on macOS." };
  }
  const key = (args.key || "").trim();
  if (!key) {
    return { ok: false, message: "Key cannot be empty." };
  }

  const normalized = key.toLowerCase();
  const keyCodeMap: Record<string, number> = {
    enter: 36,
    return: 36,
    tab: 48,
    escape: 53,
    esc: 53,
  };
  const keyCode = keyCodeMap[normalized];
  const useKeyCode = keyCode !== undefined || key.length > 1;
  const keyForScript = useKeyCode ? String(keyCode ?? "") : key;

  const script = `
on run argv
  set theKey to item 1 of argv
  set appName to ""
  if (count of argv) ≥ 2 then set appName to item 2 of argv
  set modifiersText to ""
  if (count of argv) ≥ 3 then set modifiersText to item 3 of argv
  set modList to {}
  if modifiersText is not "" then
    set AppleScript's text item delimiters to ","
    repeat with m in text items of modifiersText
      set mLower to (m as text)
      if mLower is "command" or mLower is "cmd" then
        set end of modList to command down
      else if mLower is "control" or mLower is "ctrl" then
        set end of modList to control down
      else if mLower is "option" or mLower is "alt" then
        set end of modList to option down
      else if mLower is "shift" then
        set end of modList to shift down
      end if
    end repeat
    set AppleScript's text item delimiters to ""
  end if
  if appName is not "" then
    tell application appName to activate
    delay 0.1
  end if
  tell application "System Events"
    try
      if theKey is "" then error "missing key"
      if theKey is "KEYCODE_MODE" then
        set kc to (item 4 of argv) as integer
        if (count of modList) > 0 then
          key code kc using modList
        else
          key code kc
        end if
      else
        if (count of modList) > 0 then
          keystroke theKey using modList
        else
          keystroke theKey
        end if
      end if
    on error errMsg number errNum
      return "error"
    end try
  end tell
  return "sent"
end run
  `.trim();

  const modArg = (args.modifiers || []).join(",");
  const scriptArgs = [useKeyCode ? "KEYCODE_MODE" : keyForScript];
  if (args.appName) scriptArgs.push(args.appName);
  else scriptArgs.push("");
  scriptArgs.push(modArg);
  if (useKeyCode) {
    scriptArgs.push(keyForScript);
  }

  try {
    const result = await runAppleScript(script, scriptArgs);
    return { ok: result === "sent", data: { sent: result === "sent" } };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, message };
  }
}

export interface UiKeysArgs {
  key: string;
  modifiers?: Modifier[];
  appName?: string;
}

export const uiKeysTool: ToolDefinition<UiKeysArgs> = {
  name: "uiKeys",
  description:
    "Send a keystroke (with optional modifiers) to the frontmost app or a specified app. Requires macOS accessibility permission.",
  parameters: {
    type: "object",
    properties: {
      key: { type: "string", description: "Single character key to press (e.g., t, w, l)." },
      modifiers: {
        type: "array",
        description: "Optional modifiers: command|cmd, control|ctrl, option|alt, shift.",
      },
      appName: { type: "string", description: "Optional app name to focus before sending keys." },
    },
    required: ["key"],
  },
  handler: async (args) => {
    return pressKeys(args);
  },
};
