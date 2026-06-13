import fs from "fs";
import os from "os";
import path from "path";
import request from "supertest";
import { createHttpServer } from "../src/api/http";
import { AppConfig } from "../src/config/env";
import { createDatabase } from "../src/db/sqlite";

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

  const { app } = createHttpServer({
    db,
    config,
    tools: {},
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
      .send({ sessionId: "s1" })
      .expect(400)
      .expect((res) => {
        if (res.body.error !== "text is required") {
          throw new Error("Expected text validation error");
        }
      });

    await request(app)
      .post("/v0/query")
      .send({ sessionId: "s1", text: "start dictation" })
      .expect(200)
      .expect((res) => {
        if (res.body.mode !== "ANSWER") {
          throw new Error("Expected ANSWER mode");
        }
        if (!res.body.replyText?.includes("Dictation started")) {
          throw new Error("Expected dictation start response");
        }
      });

    await request(app)
      .post("/v0/query")
      .send({ sessionId: "s1", text: "stop dictation" })
      .expect(200)
      .expect((res) => {
        if (res.body.mode !== "ANSWER") {
          throw new Error("Expected ANSWER mode");
        }
        if (!res.body.replyText?.includes("Dictation stopped")) {
          throw new Error("Expected dictation stop response");
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
