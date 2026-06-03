import type { Request, Response, NextFunction } from "express";

// Simple in-memory fixed-window limiter for write routes. Per-IP, resets each
// window. Enough for a single-instance demo; a multi-instance deploy would move
// this to Redis.
type Bucket = { count: number; reset: number };
const buckets = new Map<string, Bucket>();

export function rateLimit(max: number, windowMs: number) {
  return (req: Request, res: Response, next: NextFunction) => {
    const key = req.ip ?? "unknown";
    const now = Date.now();
    const bucket = buckets.get(key);

    if (!bucket || now > bucket.reset) {
      buckets.set(key, { count: 1, reset: now + windowMs });
      return next();
    }
    if (bucket.count >= max) {
      return res.status(429).json({ error: "too many requests" });
    }
    bucket.count++;
    next();
  };
}
