import { execFile } from "child_process";
import { promisify } from "util";
import { ToolDefinition, ToolResult } from "./types";

const execFileAsync = promisify(execFile);

type SnapshotRow = { window: string; role: string; name: string };

async function runAppleScript(script: string): Promise<string> {
  const { stdout } = await execFileAsync("osascript", ["-l", "AppleScript", "-e", script]);
  return stdout.trim();
}

async function getSnapshot(maxItems = 60): Promise<ToolResult<{ app: string; items: SnapshotRow[] }>> {
  if (process.platform !== "darwin") {
    return { ok: false, message: "uiSnapshot is only supported on macOS." };
  }

  const script = `
set maxItems to ${maxItems}
set results to {}
set appName to ""
tell application "System Events"
  set frontApp to first application process whose frontmost is true
  set appName to name of frontApp
  repeat with w in windows of frontApp
    try
      set wname to name of w
    on error
      set wname to ""
    end try
    try
      set elems to UI elements of w
      repeat with el in elems
        try
          set ename to ""
          set erole to ""
          try
            set ename to name of el
          end try
          try
            set erole to role of el
          end try
          if ename is missing value then set ename to ""
          if erole is missing value then set erole to ""
          set end of results to (wname & "||" & erole & "||" & ename)
          if (count of results) ≥ maxItems then exit repeat
        end try
      end repeat
      if (count of results) ≥ maxItems then exit repeat
    end try
  end repeat
end tell
set text item delimiters to "\n"
return (appName & "\n" & (results as string))
  `.trim();

  try {
    const raw = await runAppleScript(script);
    const lines = raw.split("\n");
    const app = lines.shift() || "";
    const items: SnapshotRow[] = lines
      .map((line) => line.split("||"))
      .filter((parts) => parts.length === 3)
      .map(([window, role, name]) => ({
        window: window || "",
        role: role || "",
        name: name || "",
      }));
    return { ok: true, data: { app, items } };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, message };
  }
}

export const uiSnapshotTool: ToolDefinition = {
  name: "uiSnapshot",
  description: "Capture a lightweight accessibility snapshot (window, role, name) from the frontmost app. Requires accessibility permission.",
  parameters: {
    type: "object",
    properties: {},
    required: [],
  },
  handler: async () => {
    return getSnapshot();
  },
};
