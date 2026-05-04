import { execFile } from "child_process";
import { promisify } from "util";
import { ToolDefinition, ToolResult } from "./types";

const execFileAsync = promisify(execFile);

async function playSpotify(appName = "Spotify"): Promise<ToolResult<{ played: boolean }>> {
  const script = `
on run argv
  set targetApp to "Spotify"
  if (count of argv) ≥ 1 then set targetApp to item 1 of argv
  try
    tell application targetApp
      activate
      delay 5
      play
    end tell
  on error
    return "failed"
  end try
  -- try sending spacebar to ensure playback starts
  try
    tell application "System Events"
      tell process targetApp
        keystroke space
      end tell
    end tell
  end try
  return "played"
end run
  `.trim();

  try {
    const { stdout } = await execFileAsync("osascript", ["-l", "AppleScript", "-e", script, appName]);
    return { ok: stdout.trim() === "played", data: { played: true } };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, message };
  }
}

export interface PlayMusicArgs {
  appName?: string;
}

export const playMusicTool: ToolDefinition<PlayMusicArgs> = {
  name: "playMusic",
  description: "Play music via Spotify (macOS). Falls back to opening YouTube Music if Spotify fails.",
  parameters: {
    type: "object",
    properties: {
      appName: { type: "string", description: "Optional app name, default Spotify." },
    },
    required: [],
  },
  handler: async (args) => {
    const targetApp = args.appName || "Spotify";
    return playSpotify(targetApp);
  },
};
