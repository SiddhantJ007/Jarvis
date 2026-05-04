import { createHttpServer } from "./api/http";
import { getConfig } from "./config/env";
import { createDatabase } from "./db/sqlite";
import { getToolRegistry } from "./tools";

async function main() {
  const config = getConfig();
  const db = createDatabase(config);
  const tools = getToolRegistry();
  const logger = console;

  const { app } = createHttpServer({ db, config, tools, logger });

  const server = app.listen(config.port, () => {
    logger.log(`[server] Jarvis daemon listening on http://localhost:${config.port}`);
    logger.log(`[server] Data directory: ${config.baseDir}`);
  });

  const shutdown = () => {
    logger.log("[server] Shutting down...");
    server.close(() => {
      db.close();
      logger.log("[server] Shutdown complete.");
      process.exit(0);
    });
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
