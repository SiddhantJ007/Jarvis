import { execFile } from "child_process";
import { promisify } from "util";
import { ToolDefinition } from "./types";

const execFileAsync = promisify(execFile);

async function quitApp(appName: string) {
  const script = `
on run argv
  set appName to item 1 of argv
  tell application appName to quit
  delay 0.2
  return "ok"
end run
  `.trim();
  await execFileAsync("osascript", ["-e", script, appName]);
}

export const closeApplicationTool: ToolDefinition<{ name: string }> = {
  name: "closeApplication",
  description: "Quit/close a macOS application by name.",
  parameters: {
    type: "object",
    properties: {
      name: { type: "string", description: "Application name to close." },
    },
    required: ["name"],
  },
  handler: async (args) => {
    if (process.platform !== "darwin") {
      return { ok: false, message: "closeApplication is only supported on macOS." };
    }
    const name = (args.name || "").trim();
    if (!name) return { ok: false, message: "Application name cannot be empty." };
    try {
      await quitApp(name);
      return { ok: true, data: { closed: name } };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { ok: false, message };
    }
  },
};
