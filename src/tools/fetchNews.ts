import { ToolDefinition, ToolResult } from "./types";

type NewsArticle = { title: string; url?: string; source?: { name?: string } };

export const fetchNewsTool: ToolDefinition = {
  name: "fetchNews",
  description:
    "Fetch top headlines (US) using newsapi.org. Requires NEWS_API_KEY in env. Returns titles only.",
  parameters: {
    type: "object",
    properties: {
      query: { type: "string", description: "Optional search query" },
    },
    required: [],
  },
  handler: async (args): Promise<ToolResult<{ headlines: string[] }>> => {
    const apiKey = process.env.NEWS_API_KEY;
    if (!apiKey) {
      return { ok: false, message: "NEWS_API_KEY not set." };
    }

    const q = args?.query ? `&q=${encodeURIComponent(args.query)}` : "";
    const url = `https://newsapi.org/v2/top-headlines?country=us&pageSize=5${q}&apiKey=${apiKey}`;

    try {
      const res = await fetch(url);
      if (!res.ok) {
        return { ok: false, message: `HTTP ${res.status}` };
      }
      const data = (await res.json()) as { articles?: NewsArticle[] };
      const titles = (data.articles || []).map((a) => a.title).filter(Boolean) as string[];
      if (!titles.length) {
        return { ok: false, message: "No headlines returned." };
      }
      return { ok: true, data: { headlines: titles } };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { ok: false, message };
    }
  },
};
