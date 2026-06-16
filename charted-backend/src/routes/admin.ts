import { Router } from "express";
import { z } from "zod";
import { requireAuth, requireRole } from "../lib/requireAuth";
import { rateLimit } from "../lib/rateLimit";
import type { Role } from "../lib/auth";
import {
  listUsers,
  getUserById,
  updateUserRole,
  setUserActive,
  toPublicUser,
} from "../db/users";
import { listRecentAudit } from "../db/queries";
import { getAdminStats } from "../db/stats";

export const adminRouter = Router();

const writeLimit = rateLimit(30, 60_000);
const ROLES = ["PATIENT", "DOCTOR", "ADMIN"] as const;

// Everything under /api/admin requires an authenticated ADMIN.
adminRouter.use(requireAuth, requireRole("ADMIN"));

const roleSchema = z.object({ role: z.enum(ROLES) });
const statusSchema = z.object({ isActive: z.boolean() });

// GET /api/admin/users[?role=DOCTOR] — directory of all users, optionally filtered.
adminRouter.get("/users", async (req, res, next) => {
  try {
    const q = typeof req.query.role === "string" ? req.query.role : undefined;
    const role = q && (ROLES as readonly string[]).includes(q) ? (q as Role) : undefined;
    const users = (await listUsers(role)).map(toPublicUser);
    res.json({ users });
  } catch (err) {
    next(err);
  }
});

// GET /api/admin/users/:id — one user.
adminRouter.get("/users/:id", async (req, res, next) => {
  try {
    const user = await getUserById(req.params.id);
    if (!user) return res.status(404).json({ error: "user not found" });
    res.json({ user: toPublicUser(user) });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/admin/users/:id/role — promote/change a user's role.
adminRouter.patch("/users/:id/role", writeLimit, async (req, res, next) => {
  try {
    const parsed = roleSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "invalid role" });
    if (req.params.id === req.user!.id) {
      return res.status(400).json({ error: "cannot change your own role" });
    }
    const user = await updateUserRole(req.params.id, parsed.data.role);
    if (!user) return res.status(404).json({ error: "user not found" });
    res.json({ user: toPublicUser(user) });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/admin/users/:id/status — activate/deactivate an account.
adminRouter.patch("/users/:id/status", writeLimit, async (req, res, next) => {
  try {
    const parsed = statusSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "invalid status" });
    if (req.params.id === req.user!.id) {
      return res.status(400).json({ error: "cannot change your own status" });
    }
    const user = await setUserActive(req.params.id, parsed.data.isActive);
    if (!user) return res.status(404).json({ error: "user not found" });
    res.json({ user: toPublicUser(user) });
  } catch (err) {
    next(err);
  }
});

// GET /api/admin/stats — dashboard summary counts.
adminRouter.get("/stats", async (_req, res, next) => {
  try {
    res.json({ stats: await getAdminStats() });
  } catch (err) {
    next(err);
  }
});

// GET /api/admin/audit[?limit=50] — system-wide activity feed.
adminRouter.get("/audit", async (req, res, next) => {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200);
    const entries = await listRecentAudit(limit);
    res.json({
      audit: entries.map((a) => ({
        action: a.action,
        actor: a.actor,
        visitId: a.visit_id,
        detail: a.detail,
        createdAt: a.created_at,
      })),
    });
  } catch (err) {
    next(err);
  }
});
