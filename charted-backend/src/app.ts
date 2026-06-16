import express, { type NextFunction, type Request, type Response } from "express";
import { MulterError } from "multer";
import { cors } from "./lib/cors";
import { healthRouter } from "./routes/health";
import { visitsRouter } from "./routes/visits";
import { authRouter } from "./routes/auth";
import { doctorsRouter } from "./routes/doctors";
import { adminRouter } from "./routes/admin";
import { appointmentsRouter } from "./routes/appointments";
import { prescriptionsRouter } from "./routes/prescriptions";
import { patientsRouter } from "./routes/patients";

export const app = express();
app.use(cors);
app.use(express.json({ limit: "1mb" }));

app.use("/api/health", healthRouter);
app.use("/api/auth", authRouter);
app.use("/api/doctors", doctorsRouter);
app.use("/api/admin", adminRouter);
app.use("/api/appointments", appointmentsRouter);
app.use("/api/prescriptions", prescriptionsRouter);
app.use("/api/patients", patientsRouter);
app.use("/api/visits", visitsRouter);

// Central error handler. Routes pass real failures here via next(err).
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err);
  if (err instanceof MulterError) {
    return res.status(400).json({ error: `upload error: ${err.message}` });
  }
  const message = err instanceof Error ? err.message : "internal error";
  res.status(500).json({ error: message });
});
