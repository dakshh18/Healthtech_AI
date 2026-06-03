import { Router } from "express";
import { pool } from "../db/pool";

export const healthRouter = Router();

healthRouter.get("/", async (_req, res) => {
  let db = "down";
  try {
    await pool.query("select 1");
    db = "up";
  } catch {
    db = "down";
  }

  res.json({
    status: db === "up" ? "ok" : "degraded",
    db,
    model: process.env.OPENAI_API_KEY ? "configured" : "missing",
  });
});
