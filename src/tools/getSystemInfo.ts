import os from "os";
import { ToolDefinition } from "./types";

export const getSystemInfoTool: ToolDefinition = {
  name: "getSystemInfo",
  description: "Return basic system information (OS, hostname, uptime).",
  parameters: {
    type: "object",
    properties: {},
  },
  handler: async () => {
    return {
      ok: true,
      data: {
        platform: os.platform(),
        release: os.release(),
        arch: os.arch(),
        hostname: os.hostname(),
        uptimeSec: os.uptime(),
      },
    };
  },
};
