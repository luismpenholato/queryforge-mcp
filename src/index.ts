#!/usr/bin/env node
import { startServer } from "./mcp/server.js";

process.on("uncaughtException", (error) => {
  console.error("[queryforge-mcp] Uncaught exception:", error);
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  console.error("[queryforge-mcp] Unhandled rejection:", reason);
  process.exit(1);
});

startServer().catch((error) => {
  console.error("[queryforge-mcp] Failed to start:", error);
  process.exit(1);
});
