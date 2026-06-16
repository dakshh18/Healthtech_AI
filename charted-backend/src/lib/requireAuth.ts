import type { Request, Response, NextFunction } from "express";
import { verifyToken, type Role } from "./auth";

// Authentication gate: requires a valid `Authorization: Bearer <token>` header
// and attaches the decoded user to req.user. Use before requireRole().
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization ?? "";
  const [scheme, token] = header.split(" ");
  if (scheme !== "Bearer" || !token) {
    return res
      .status(401)
      .json({ error: "missing or malformed Authorization header" });
  }
  try {
    req.user = verifyToken(token);
    next();
  } catch {
    return res.status(401).json({ error: "invalid or expired token" });
  }
}

// Authorization gate: assumes requireAuth ran first. Allows the request only if
// the user's role is in the allowed set.
export function requireRole(...roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: "authentication required" });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: "insufficient role" });
    }
    next();
  };
}
