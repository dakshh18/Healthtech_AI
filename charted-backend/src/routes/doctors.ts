import { Router } from "express";
import { z } from "zod";
import { requireAuth, requireRole } from "../lib/requireAuth";
import { rateLimit } from "../lib/rateLimit";
import {
  getDoctorByUserId,
  createDoctorProfile,
  updateDoctorProfile,
  listDoctors,
} from "../db/doctors";

export const doctorsRouter = Router();

const writeLimit = rateLimit(30, 60_000);

const createSchema = z.object({
  specialization: z.string().trim().min(1).max(100),
  experienceYears: z.number().int().min(0).max(70).default(0),
  qualification: z.string().trim().max(255).optional(),
  bio: z.string().trim().max(2000).optional(),
});
const updateSchema = z.object({
  specialization: z.string().trim().min(1).max(100).optional(),
  experienceYears: z.number().int().min(0).max(70).optional(),
  qualification: z.string().trim().max(255).optional(),
  bio: z.string().trim().max(2000).optional(),
});

doctorsRouter.get("/", requireAuth, async (_req, res, next) => {
  try {
    const doctors = await listDoctors();
    res.json({ doctors });
  } catch (err) {
    next(err);
  }
});

// GET /api/doctors/me — the logged-in doctor's own profile.
doctorsRouter.get("/me", requireAuth, requireRole("DOCTOR"), async (req, res, next) => {
  try {
    const doctor = await getDoctorByUserId(req.user!.id);
    if (!doctor) return res.status(404).json({ error: "no doctor profile yet" });
    res.json({ doctor });
  } catch (err) {
    next(err);
  }
});

// POST /api/doctors/me — create the logged-in doctor's profile.
doctorsRouter.post("/me", requireAuth, requireRole("DOCTOR"), writeLimit, async (req, res, next) => {
  try {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "invalid profile", details: parsed.error.flatten() });
    }
    const existing = await getDoctorByUserId(req.user!.id);
    if (existing) {
      return res.status(409).json({ error: "doctor profile already exists; use PATCH" });
    }
    const doctor = await createDoctorProfile(req.user!.id, parsed.data);
    res.status(201).json({ doctor });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/doctors/me — update the logged-in doctor's profile.
doctorsRouter.patch("/me", requireAuth, requireRole("DOCTOR"), writeLimit, async (req, res, next) => {
  try {
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "invalid profile", details: parsed.error.flatten() });
    }
    const doctor = await updateDoctorProfile(req.user!.id, parsed.data);
    if (!doctor) return res.status(404).json({ error: "no doctor profile yet; use POST" });
    res.json({ doctor });
  } catch (err) {
    next(err);
  }
});
