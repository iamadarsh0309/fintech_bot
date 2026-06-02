import express from "express";
import cors from "cors";
import multer from "multer";

import { settings } from "./config.js";
import { HttpError } from "./errors.js";
import { authRouter } from "./routes/auth.js";
import { sessionsRouter } from "./routes/sessions.js";

export function createApp() {
  const app = express();

  app.use(
    cors({
      origin: settings.backendCorsOrigins,
      credentials: true,
    }),
  );
  app.use(express.json({ limit: "2mb" }));

  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.use(authRouter);
  app.use("/sessions", sessionsRouter);

  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    if (err instanceof HttpError) {
      return res.status(err.statusCode).json({ detail: err.detail });
    }
    if (err instanceof multer.MulterError) {
      return res.status(400).json({ detail: err.message });
    }
    if (err.type === "entity.parse.failed" || err instanceof SyntaxError) {
      return res.status(400).json({ detail: "Invalid JSON body" });
    }
    // eslint-disable-next-line no-console
    console.error(err);
    return res.status(500).json({ detail: "Internal server error" });
  });

  return app;
}
