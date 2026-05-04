import { spawn } from "child_process";
import { ToolDefinition } from "./types";

async function writeClipboard(text: string): Promise<void> {
  if (process.platform !== "darwin") {
    throw new Error("Clipboard copy is only supported on macOS in this tool.");
  }
  await new Promise<void>((resolve, reject) => {
    const proc = spawn("pbcopy");
    proc.on("error", reject);
    proc.stdin.write(text, (err) => {
      if (err) {
        reject(err);
      } else {
        proc.stdin.end();
      }
    });
    proc.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`pbcopy exited with code ${code}`));
    });
  });
}

export const copyClipboardTool: ToolDefinition<{
  text?: string;
  sessionId?: string;
}> = {
  name: "copyClipboard",
  description:
    "Copy provided text to the clipboard. If no text is provided, copies the latest assistant response for the session.",
  parameters: {
    type: "object",
    properties: {
      text: { type: "string", description: "Text to copy. If empty, uses latest assistant reply." },
      sessionId: { type: "string", description: "Session id for looking up last assistant reply." },
    },
    required: [],
  },
  handler: async (args, ctx) => {
    try {
      const provided = (args.text || "").trim();
      const sessionId = (args.sessionId || "").trim();
      let payload = provided;

      if (!payload) {
        if (!sessionId) {
          return { ok: false, message: "No text provided and no session id to lookup reply." };
        }
        const last = ctx.db.getLastAssistantMessage(sessionId);
        if (!last?.text) {
          return { ok: false, message: "No assistant reply found to copy." };
        }
        payload = last.text;
      }

      await writeClipboard(payload);
      return { ok: true, data: { copied: true, length: payload.length } };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { ok: false, message };
    }
  },
};
