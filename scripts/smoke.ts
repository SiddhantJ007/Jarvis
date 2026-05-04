import fs from "fs";
import os from "os";
import path from "path";
import request from "supertest";
import { createHttpServer } from "../src/api/http";
import { AppConfig } from "../src/config/env";
import { createDatabase } from "../src/db/sqlite";
import { ToolDefinition, ToolRegistry } from "../src/tools/types";

async function run() {
  const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), "jarvis-smoke-"));
  const config: AppConfig = {
    port: 0,
    baseDir,
    dbPath: path.join(baseDir, "jarvis.db"),
    ttsStubEnabled: true,
    openaiApiKey: process.env.OPENAI_API_KEY,
  };

  const db = createDatabase(config);

  // Stub openApplication to avoid actually launching apps during smoke tests.
  const stubOpenApplication: ToolDefinition = {
    name: "openApplication",
    description: "Stubbed openApplication",
    parameters: {
      type: "object",
      properties: { name: { type: "string" } },
      required: ["name"],
    },
    handler: async (args) => ({ ok: true, data: { opened: args.name } }),
  };
  const tools: ToolRegistry = { openApplication: stubOpenApplication };

  const { app } = createHttpServer({
    db,
    config,
    tools,
    logger: console,
  });

  try {
    await request(app)
      .get("/health")
      .expect(200)
      .expect((res) => {
        if (!res.body.ok) throw new Error("Health check failed");
        if (res.body.baseDir !== baseDir) {
          throw new Error("Health baseDir mismatch");
        }
      });

    await request(app)
      .post("/v0/query")
      .send({ sessionId: "s1", text: "hello" })
      .expect(200)
      .expect((res) => {
        if (res.body.mode !== "ANSWER") {
          throw new Error("Expected ANSWER mode");
        }
        if (!res.body.ttsAudioBase64) {
          throw new Error("Expected TTS stub");
        }
      });

    await request(app)
      .post("/v0/query")
      .send({ sessionId: "s1", text: "open app Calculator" })
      .expect(200)
      .expect((res) => {
        if (res.body.mode !== "ACTION") {
          throw new Error("Expected ACTION mode");
        }
        if (!res.body.toolCalls || res.body.toolCalls.length === 0) {
          throw new Error("Expected tool call");
        }
      });

    console.log("Smoke tests passed.");
  } finally {
    db.close();
    fs.rmSync(baseDir, { recursive: true, force: true });
  }
}

run().catch((err) => {
  console.error("Smoke tests failed:", err);
  process.exit(1);
});
