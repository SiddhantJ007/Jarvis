import express, { Request, Response, NextFunction } from "express";
import { PipelineContext, handleQuery } from "../core/pipeline";
import { transcribeAudio } from "../core/stt";

export function createHttpServer(ctx: PipelineContext) {
  const app = express();
  app.use(express.json());

  app.use((req, res, next) => {
    const start = Date.now();
    res.on("finish", () => {
      const duration = Date.now() - start;
      ctx.logger?.log?.(
        `[http] ${req.method} ${req.originalUrl} ${res.statusCode} ${duration}ms`
      );
    });
    next();
  });

  app.get("/health", (req: Request, res: Response) => {
    res.json({ ok: true, baseDir: ctx.config.baseDir });
  });

  app.get("/hud", (_req: Request, res: Response) => {
    res.type("html").send(`<!doctype html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>Jarvis HUD</title>
  <style>
    :root {
      color-scheme: dark;
      --bg: rgba(15,15,17,0.85);
      --panel: rgba(30,32,36,0.9);
      --accent: #4da3ff;
      --text: #e7ecf2;
      --muted: #9aa4b1;
      --border: rgba(255,255,255,0.08);
      --success: #7bd88f;
      --error: #ff7b7b;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: "SF Pro Display", "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background: radial-gradient(120% 120% at 10% 20%, rgba(77,163,255,0.18), rgba(15,15,17,0.95)),
                  radial-gradient(90% 90% at 80% 10%, rgba(123,216,143,0.12), rgba(15,15,17,0.9));
      color: var(--text);
      height: 100vh;
      display: flex;
      justify-content: center;
      align-items: center;
      padding: 24px;
    }
    .hud {
      width: min(1100px, 100%);
      min-height: 640px;
      background: var(--bg);
      border: 1px solid var(--border);
      border-radius: 16px;
      box-shadow: 0 24px 80px rgba(0,0,0,0.45);
      display: grid;
      grid-template-rows: auto 1fr auto;
      overflow: hidden;
      backdrop-filter: blur(12px);
    }
    header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 14px 18px;
      border-bottom: 1px solid var(--border);
      background: linear-gradient(90deg, rgba(77,163,255,0.12), rgba(77,163,255,0));
    }
    .title { display: flex; gap: 10px; align-items: center; font-weight: 700; }
    .pill { padding: 4px 8px; border-radius: 999px; background: rgba(255,255,255,0.06); font-size: 12px; color: var(--muted); }
    .status-row { display: flex; gap: 8px; flex-wrap: wrap; }
    .chip { padding: 6px 10px; border-radius: 10px; background: rgba(255,255,255,0.06); font-size: 12px; color: var(--muted); border: 1px solid var(--border); }
    .chip.live { color: var(--accent); border-color: rgba(77,163,255,0.45); }
    .chip.error { color: var(--error); border-color: rgba(255,123,123,0.45); }
    main { display: grid; grid-template-columns: 1fr 1fr; gap: 0; border-bottom: 1px solid var(--border); }
    .panel { padding: 16px; background: var(--panel); min-height: 320px; }
    .panel + .panel { border-left: 1px solid var(--border); }
    .panel h3 { margin: 0 0 10px; font-size: 14px; color: var(--muted); letter-spacing: 0.4px; }
    .log { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 10px; max-height: 360px; overflow-y: auto; }
    .log li { padding: 10px 12px; border-radius: 10px; border: 1px solid var(--border); background: rgba(255,255,255,0.03); font-size: 14px; }
    .log .ts { color: var(--muted); font-size: 12px; margin-bottom: 4px; }
    footer { padding: 14px 16px; display: flex; gap: 10px; align-items: center; background: rgba(255,255,255,0.02); }
    footer input, footer textarea {
      flex: 1;
      padding: 10px 12px;
      border-radius: 10px;
      border: 1px solid var(--border);
      background: rgba(255,255,255,0.05);
      color: var(--text);
      resize: vertical;
      min-height: 46px;
    }
    footer button {
      padding: 12px 16px;
      border: none;
      border-radius: 12px;
      background: linear-gradient(135deg, #4da3ff, #7bd88f);
      color: #0c0d0f;
      font-weight: 700;
      cursor: pointer;
      box-shadow: 0 8px 24px rgba(77,163,255,0.35);
    }
    footer .input-small { flex: 0 0 160px; }
  </style>
</head>
<body>
  <div class="hud">
    <header>
      <div class="title">
        <span style="width:10px;height:10px;border-radius:50%;background:#4da3ff;box-shadow:0 0 12px rgba(77,163,255,0.6);"></span>
        <div>
          <div>Jarvis HUD</div>
          <div class="pill">Session monitor</div>
        </div>
      </div>
      <div class="status-row">
        <div class="chip live" id="chip-session">Session: —</div>
        <div class="chip" id="chip-mode">Idle</div>
        <div class="chip" id="chip-error" style="display:none;"></div>
      </div>
    </header>
    <main>
      <section class="panel">
        <h3>You</h3>
        <ul class="log" id="user-log"></ul>
      </section>
      <section class="panel">
        <h3>Jarvis</h3>
        <ul class="log" id="jarvis-log"></ul>
      </section>
    </main>
    <footer>
      <input class="input-small" id="sessionId" placeholder="Session ID (e.g., default)" />
      <textarea id="text" placeholder="Ask or command Jarvis..."></textarea>
      <button id="send">Send</button>
    </footer>
  </div>
  <script>
    const userLog = document.getElementById("user-log");
    const jarvisLog = document.getElementById("jarvis-log");
    const chipSession = document.getElementById("chip-session");
    const chipMode = document.getElementById("chip-mode");
    const chipError = document.getElementById("chip-error");
    const sessionInput = document.getElementById("sessionId");
    const textInput = document.getElementById("text");
    const sendBtn = document.getElementById("send");

    const addEntry = (logEl, label, text) => {
      const li = document.createElement("li");
      const ts = document.createElement("div");
      ts.className = "ts";
      ts.textContent = label;
      const body = document.createElement("div");
      body.textContent = text;
      li.appendChild(ts);
      li.appendChild(body);
      logEl.appendChild(li);
      logEl.scrollTop = logEl.scrollHeight;
    };

    const updateError = (msg) => {
      if (msg) {
        chipError.style.display = "inline-flex";
        chipError.className = "chip error";
        chipError.textContent = msg;
      } else {
        chipError.style.display = "none";
      }
    };

    sendBtn.onclick = async () => {
      const sessionId = sessionInput.value.trim() || "default";
      const text = textInput.value.trim();
      if (!text) return;
      chipSession.textContent = "Session: " + sessionId;
      chipMode.textContent = "Sending…";
      chipMode.className = "chip live";
      updateError("");
      addEntry(userLog, new Date().toLocaleTimeString(), text);
      try {
        const res = await fetch("/v0/query", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId, text }),
        });
        if (!res.ok) throw new Error(await res.text());
        const data = await res.json();
        chipMode.textContent = data.mode || "ANSWER";
        addEntry(jarvisLog, new Date().toLocaleTimeString(), data.replyText || "(no reply)");
        if (data.ttsAudioBase64) {
          const audio = new Audio("data:audio/mp3;base64," + data.ttsAudioBase64);
          audio.play().catch(()=>{});
        }
      } catch (err) {
        chipMode.textContent = "Error";
        chipMode.className = "chip error";
        updateError("Request failed");
      } finally {
        textInput.value = "";
      }
    };

    textInput.addEventListener("keydown", (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        sendBtn.click();
      }
    });
  </script>
</body>
</html>`);
  });

  app.post(
    "/v0/query",
    async (req: Request, res: Response, next: NextFunction) => {
      const { sessionId, text, source } = req.body || {};

      if (!sessionId || typeof sessionId !== "string") {
        return res.status(400).json({ error: "sessionId is required" });
      }

      if (!text || typeof text !== "string") {
        return res.status(400).json({ error: "text is required" });
      }

      try {
        const response = await handleQuery(
          { sessionId, text, source },
          { ...ctx, logger: ctx.logger || console }
        );
        res.json(response);
      } catch (error) {
        next(error);
      }
    }
  );

  // Raw body parser for audio
  app.post(
    "/v0/stt",
    express.raw({ type: ["audio/m4a", "audio/webm", "audio/wav", "audio/ogg", "audio/mp3"], limit: "10mb" }),
    async (req: Request, res: Response) => {
      try {
        const mimeType = req.headers["content-type"] || "";
        const body = req.body;
        if (!Buffer.isBuffer(body)) {
          return res.status(400).json({ error: "Invalid audio body" });
        }
        const text = await transcribeAudio(body, mimeType);
        res.json({ text });
      } catch (err) {
        const message = err instanceof Error ? err.message : "STT failed";
        ctx.logger?.error?.(`[api] STT error: ${message}`);
        res.status(500).json({ error: message });
      }
    }
  );

  app.use(
    (
      err: Error,
      _req: Request,
      res: Response,
      _next: NextFunction // eslint-disable-line @typescript-eslint/no-unused-vars
    ) => {
      const message = err.message || "Internal server error";
      ctx.logger?.error?.(`[api] Error: ${message}`);
      res.status(500).json({ error: message });
    }
  );

  return { app };
}
