import { Router } from "express";
import { z } from "zod";
import { hashPassword, verifyPassword, signToken } from "../lib/auth";
import { requireAuth } from "../lib/requireAuth";
import { rateLimit } from "../lib/rateLimit";
import {
  createUser,
  getUserByEmail,
  getUserById,
  toPublicUser,
} from "../db/users";

export const authRouter = Router();

const authLimit = rateLimit(20, 60_000);

const registerSchema = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.string().trim().email().max(100),
  password: z.string().min(8).max(200),
  role: z.enum(["PATIENT", "DOCTOR"]).default("PATIENT"),
  phone: z.string().trim().max(15).optional(),
  gender: z.enum(["Male", "Female", "Other"]).optional(),
  age: z.number().int().min(0).max(120).optional(),
});

const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
});

// POST /api/auth/register — create an account and return a signed JWT.
authRouter.post("/register", authLimit, async (req, res, next) => {
  try {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: "invalid registration", details: parsed.error.flatten() });
    }
    const { name, email, password, role, phone, gender, age } = parsed.data;

    const existing = await getUserByEmail(email);
    if (existing) {
      return res.status(409).json({ error: "email already registered" });
    }

    const passwordHash = await hashPassword(password);
    const user = await createUser({
      name,
      email: email.toLowerCase(),
      passwordHash,
      role,
      phone,
      gender,
      age,
    });
    const token = signToken({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    });

    res.status(201).json({ token, user: toPublicUser(user) });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/login — verify credentials and return a signed JWT.
authRouter.post("/login", authLimit, async (req, res, next) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "invalid login" });
    }
    const { email, password } = parsed.data;

    const user = await getUserByEmail(email);
    // Same response whether the email is unknown or the password is wrong, so
    // we don't leak which emails exist.
    if (!user || !(await verifyPassword(password, user.password_hash))) {
      return res.status(401).json({ error: "invalid credentials" });
    }
    // Deactivated accounts can't obtain new tokens (existing tokens expire).
    if (!user.is_active) {
      return res.status(403).json({ error: "account is deactivated" });
    }

    const token = signToken({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    });
    res.json({ token, user: toPublicUser(user) });
  } catch (err) {
    next(err);
  }
});

// GET /api/auth/me — the current user, resolved fresh from the DB.
authRouter.get("/me", requireAuth, async (req, res, next) => {
  try {
    const user = await getUserById(req.user!.id);
    if (!user) return res.status(404).json({ error: "user not found" });
    res.json({ user: toPublicUser(user) });
  } catch (err) {
    next(err);
  }
});
