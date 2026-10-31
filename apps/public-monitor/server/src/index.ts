import app from "./app";
import { logger } from "./lib/logger";
import { startMonitorSync, stopMonitorSync } from "./lib/monitor-sync";
import { pool } from "@workspace/db";

const rawPort = process.env["PORT"] ?? "3001";

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (!Number.isInteger(port) || port <= 0 || port > 65535) {
  throw new Error("PORT must be an integer between 1 and 65535");
}

// Fail startup before accepting traffic if migrations/configuration are missing.
await pool.query("SELECT id FROM monitor_sync LIMIT 1");
const server = app.listen(port, "0.0.0.0", (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
  startMonitorSync();
});

for (const signal of ["SIGTERM", "SIGINT"] as const) {
  process.once(signal, () => {
    stopMonitorSync();
    server.close(() => { void pool.end().then(() => process.exit(0)); });
    // An in-flight collection may be slow; PostgreSQL releases its lock on exit.
    setTimeout(() => process.exit(1), 15_000).unref();
  });
}
