import type { Request, Response, NextFunction } from "express";

// Minimal CORS for the local frontend. Single allowed origin (the Next app),
// configurable via FRONTEND_ORIGIN. Kept dependency-free on purpose.
const ORIGIN = process.env.FRONTEND_ORIGIN ?? "http://localhost:3000";

export function cors(req: Request, res: Response, next: NextFunction) {
  res.header("Access-Control-Allow-Origin", ORIGIN);
  res.header("Vary", "Origin");
  res.header("Access-Control-Allow-Methods", "GET,POST,PATCH,OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }
  next();
}
