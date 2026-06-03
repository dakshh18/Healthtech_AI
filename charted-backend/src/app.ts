import express, { type NextFunction, type Request, type Response } from "express";
import { healthRouter } from "./routes/health";
import { visitsRouter } from "./routes/visits";

export const app = express();
app.use(express.json({ limit: "1mb" }));

app.use("/api/health", healthRouter);
app.use("/api/visits", visitsRouter);

// Central error handler. Routes pass real failures here via next(err).
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err);
  const message = err instanceof Error ? err.message : "internal error";
  res.status(500).json({ error: message });
});
