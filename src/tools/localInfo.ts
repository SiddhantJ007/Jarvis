import { exec } from "child_process";
import { promisify } from "util";
import { ToolDefinition } from "./types";

const execAsync = promisify(exec);

function formatLocalDateTime() {
  const now = new Date();
  const localTime = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const localDate = now.toISOString().slice(0, 10);
  const weekday = now.toLocaleDateString([], { weekday: "long" });
  return { localTime, localDate, weekday };
}

export const getLocalDateTimeTool: ToolDefinition = {
  name: "getLocalDateTime",
  description: "Get the current local time, date, and weekday.",
  parameters: {
    type: "object",
    properties: {},
  },
  handler: async () => {
    return { ok: true, data: formatLocalDateTime() };
  },
};

export const getDiskUsageTool: ToolDefinition = {
  name: "getDiskUsage",
  description: "Get basic disk usage for the root volume.",
  parameters: {
    type: "object",
    properties: {},
  },
  handler: async (_args, ctx) => {
    try {
      const { stdout } = await execAsync("df -k /");
      const lines = stdout.trim().split("\n");
      if (lines.length < 2) {
        return { ok: false, message: "Unexpected df output" };
      }
      const parts = lines[1].split(/\s+/);
      if (parts.length < 5) {
        return { ok: false, message: "Unexpected df output format" };
      }
      const totalKb = Number(parts[1]);
      const usedKb = Number(parts[2]);
      const availKb = Number(parts[3]);
      const totalBytes = totalKb * 1024;
      const usedBytes = usedKb * 1024;
      const freeBytes = availKb * 1024;
      const humanReadable = `${(freeBytes / 1e9).toFixed(1)} GB free of ${(totalBytes / 1e9).toFixed(1)} GB`;
      return {
        ok: true,
        data: { totalBytes, usedBytes, freeBytes, humanReadable },
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      ctx.logger?.error?.(`[tool] getDiskUsage error: ${msg}`);
      return { ok: false, message: msg };
    }
  },
};

export const openWeatherTool: ToolDefinition = {
  name: "openWeather",
  description: "Open the Weather app or a weather website.",
  parameters: { type: "object", properties: {} },
  handler: async (_args, ctx) => {
    try {
      const result = await execAsync(`open -a "Weather"`);
      ctx.logger?.log?.("[tool] openWeather used Weather app");
      return { ok: true, data: { opened: "Weather app" } };
    } catch {
      try {
        await execAsync(`open "https://www.weather.com"`);
        ctx.logger?.log?.("[tool] openWeather fallback to weather.com");
        return { ok: true, data: { opened: "weather.com" } };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        ctx.logger?.error?.(`[tool] openWeather error: ${msg}`);
        return { ok: false, message: msg };
      }
    }
  },
};

export const openAppleNewsTool: ToolDefinition = {
  name: "openAppleNews",
  description: "Open Apple News app or news site.",
  parameters: { type: "object", properties: {} },
  handler: async (_args, ctx) => {
    try {
      await execAsync(`open -a "News"`);
      ctx.logger?.log?.("[tool] openAppleNews used News app");
      return { ok: true, data: { opened: "News app" } };
    } catch {
      try {
        await execAsync(`open "https://www.apple.com/newsroom/"`);
        ctx.logger?.log?.("[tool] openAppleNews fallback to news site");
        return { ok: true, data: { opened: "Apple News website" } };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        ctx.logger?.error?.(`[tool] openAppleNews error: ${msg}`);
        return { ok: false, message: msg };
      }
    }
  },
};
