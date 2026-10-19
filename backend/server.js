"use strict";

const http = require("http");
const app = require("./app");
const config = require("./config/env");
const { connectDB, disconnectDB } = require("./config/db");

async function start() {
  config.assertConfig();
  await connectDB();

  // Socket.IO attaches to this same HTTP server in Phase 4, so the server is
  // created explicitly rather than through app.listen().
  const server = http.createServer(app);

  server.listen(config.port, () => {
    console.log(`[api] Murmur API listening on http://localhost:${config.port}`);
    console.log(`[api] CORS origin: ${config.clientUrl}`);
    if (!config.cloudinaryEnabled) console.warn("[api] Image uploads are disabled.");
  });

  const shutdown = async (signal) => {
    console.log(`[api] ${signal} received, shutting down.`);
    server.close(async () => {
      await disconnectDB();
      process.exit(0);
    });
    // Do not hang forever if a connection refuses to close.
    setTimeout(() => process.exit(1), 10000).unref();
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));

  return server;
}

if (require.main === module) {
  start().catch((error) => {
    console.error("[api] failed to start:", error.message);
    process.exit(1);
  });
}

module.exports = start;
