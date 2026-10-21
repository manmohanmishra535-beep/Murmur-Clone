"use strict";

const http = require("http");
const app = require("./app");
const config = require("./config/env");
const { connectDB, disconnectDB } = require("./config/db");
const { attach } = require("./realtime/io");

async function start() {
  config.assertConfig();
  await connectDB();

  // Socket.IO runs on the same HTTP server as Express, so notifications and
  // chat share the port and the CORS origin the REST API already uses.
  const server = http.createServer(app);
  const io = attach(server);

  server.listen(config.port, () => {
    console.log(`[api] Murmur API listening on http://localhost:${config.port}`);
    console.log(`[api] CORS origin: ${config.clientUrl}`);
    if (!config.cloudinaryEnabled) console.warn("[api] Image uploads are disabled.");
    if (!config.mailEnabled) {
      console.warn("[api] SMTP is not configured; password reset links are logged only.");
    }
  });

  const shutdown = async (signal) => {
    console.log(`[api] ${signal} received, shutting down.`);
    io.close();
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
