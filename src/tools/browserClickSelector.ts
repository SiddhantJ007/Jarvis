import { ToolDefinition, ToolResult } from "./types";

type CDPMessage = { id: number; method: string; params?: Record<string, unknown> };

class CDPClient {
  private ws: WebSocket | null = null;
  private seq = 1;
  private pending = new Map<number, (res: any) => void>();

  constructor(private endpoint: string) {}

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.endpoint);
      this.ws.onopen = () => resolve();
      this.ws.onerror = (err) => reject(err);
      this.ws.onmessage = (evt) => {
        try {
          const msg = JSON.parse(evt.data as string);
          if (typeof msg.id === "number" && this.pending.has(msg.id)) {
            const resolve = this.pending.get(msg.id)!;
            this.pending.delete(msg.id);
            resolve(msg);
          }
        } catch {
          // ignore
        }
      };
      this.ws.onclose = () => {
        this.pending.forEach((res) => res({ error: "closed" }));
        this.pending.clear();
      };
    });
  }

  async send<T = any>(method: string, params?: Record<string, unknown>): Promise<T> {
    if (!this.ws) throw new Error("WebSocket not connected");
    const id = this.seq++;
    const payload: CDPMessage = { id, method, params };
    return new Promise<T>((resolve, reject) => {
      this.pending.set(id, (msg: any) => {
        if (msg.error) reject(new Error(msg.error.message || String(msg.error)));
        else resolve(msg.result as T);
      });
      this.ws!.send(JSON.stringify(payload));
    });
  }

  close() {
    try {
      this.ws?.close();
    } catch {
      // ignore
    }
  }
}

async function getWebSocketDebuggerUrl(): Promise<string | null> {
  try {
    const res = await fetch("http://127.0.0.1:9222/json");
    const list = (await res.json()) as any[];
    const page = list.find((p) => p.type === "page" && p.webSocketDebuggerUrl);
    return page?.webSocketDebuggerUrl || null;
  } catch {
    return null;
  }
}

async function clickSelectorViaCDP(
  selector: string,
  index: number
): Promise<ToolResult<{ clicked: boolean }>> {
  const wsUrl = await getWebSocketDebuggerUrl();
  if (!wsUrl) {
    return {
      ok: false,
      message: "Chrome remote debugging not reachable on 9222. Start Chrome with --remote-debugging-port=9222.",
    };
  }

  const client = new CDPClient(wsUrl);
  try {
    await client.connect();
    await client.send("Page.enable");
    await client.send("DOM.enable");

    const expr = `
(function(sel){
  const list = Array.from(document.querySelectorAll(sel));
  if (!list.length) return null;
  const idx = Math.max(0, Math.min(list.length - 1, ${index - 1}));
  const el = list[idx];
  const rect = el.getBoundingClientRect();
  if (!rect || rect.width <= 0 || rect.height <= 0) return null;
  return {
    x: rect.left + rect.width / 2 + window.scrollX,
    y: rect.top + rect.height / 2 + window.scrollY
  };
})(\`${selector}\`);
    `;

    const evalRes = await client.send<{ result: { value: { x: number; y: number } | null } }>(
      "Runtime.evaluate",
      { expression: expr, returnByValue: true }
    );
    const coords = evalRes?.result?.value;
    if (!coords || typeof coords.x !== "number" || typeof coords.y !== "number") {
      return { ok: false, message: `Selector "${selector}" not found.` };
    }

    await client.send("Page.bringToFront");
    await client.send("Input.dispatchMouseEvent", {
      type: "mouseMoved",
      x: coords.x,
      y: coords.y,
      button: "none",
    });
    await client.send("Input.dispatchMouseEvent", {
      type: "mousePressed",
      x: coords.x,
      y: coords.y,
      button: "left",
      clickCount: 1,
    });
    await client.send("Input.dispatchMouseEvent", {
      type: "mouseReleased",
      x: coords.x,
      y: coords.y,
      button: "left",
      clickCount: 1,
    });

    return { ok: true, data: { clicked: true } };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, message };
  } finally {
    client.close();
  }
}

export interface BrowserClickSelectorArgs {
  selector: string;
  index?: number;
}

export const browserClickSelectorTool: ToolDefinition<BrowserClickSelectorArgs> = {
  name: "browserClickSelector",
  description:
    "Click the nth element matching a CSS selector using Chrome DevTools. Chrome must be running with --remote-debugging-port=9222.",
  parameters: {
    type: "object",
    properties: {
      selector: { type: "string", description: "CSS selector to match elements." },
      index: { type: "number", description: "1-based index of the element to click (default 1)." },
    },
    required: ["selector"],
  },
  handler: async (args) => {
    const selector = (args.selector || "").trim();
    const index = typeof args.index === "number" && args.index > 0 ? Math.floor(args.index) : 1;
    if (!selector) return { ok: false, message: "Selector cannot be empty." };
    return clickSelectorViaCDP(selector, index);
  },
};
