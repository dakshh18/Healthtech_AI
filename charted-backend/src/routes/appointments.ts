import { Router } from "express";
import { z } from "zod";
import multer from "multer";
import { requireAuth, requireRole } from "../lib/requireAuth";
import { rateLimit } from "../lib/rateLimit";
import { getUserById } from "../db/users";
import { createVisit, getVisit } from "../db/queries";
import {
  createAppointment,
  getAppointmentById,
  listAppointmentsForPatient,
  listAppointmentsForDoctor,
  listAllAppointments,
  updateAppointmentStatus,
  linkAppointmentVisit,
} from "../db/appointments";

export const appointmentsRouter = Router();

const writeLimit = rateLimit(30, 60_000);

// Whisper accepts files up to 25MB; memory storage since we never persist audio.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
});

function newPatientRef(): string {
  return `SYN-${Math.floor(1000 + Math.random() * 9000)}`;
}

const bookSchema = z.object({
  doctorId: z.string().uuid(),
  scheduledAt: z.string().datetime({ offset: true }),
  reason: z.string().trim().max(500).optional(),
});

// POST /api/appointments — a patient books with a doctor (status PENDING).
appointmentsRouter.post("/", requireAuth, requireRole("PATIENT"), writeLimit, async (req, res, next) => {
  try {
    const parsed = bookSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "invalid booking", details: parsed.error.flatten() });
    }
    const { doctorId, scheduledAt, reason } = parsed.data;

    const doctor = await getUserById(doctorId);
    if (!doctor || doctor.role !== "DOCTOR") {
      return res.status(400).json({ error: "doctorId must reference an existing DOCTOR" });
    }

    const appointment = await createAppointment({
      patientId: req.user!.id,
      doctorId,
      scheduledAt,
      reason,
    });
    res.status(201).json({ appointment });
  } catch (err) {
    next(err);
  }
});

// GET /api/appointments — role-aware: patients see theirs, doctors see theirs,
// admins see all.
appointmentsRouter.get("/", requireAuth, async (req, res, next) => {
  try {
    const u = req.user!;
    const appointments =
      u.role === "ADMIN"
        ? await listAllAppointments()
        : u.role === "DOCTOR"
        ? await listAppointmentsForDoctor(u.id)
        : await listAppointmentsForPatient(u.id);
    res.json({ appointments });
  } catch (err) {
    next(err);
  }
});

// GET /api/appointments/:id — a participant (or admin) can view it.
appointmentsRouter.get("/:id", requireAuth, async (req, res, next) => {
  try {
    const appt = await getAppointmentById(req.params.id);
    if (!appt) return res.status(404).json({ error: "appointment not found" });

    const u = req.user!;
    const allowed = u.role === "ADMIN" || appt.patient_id === u.id || appt.doctor_id === u.id;
    if (!allowed) return res.status(403).json({ error: "not your appointment" });

    res.json({ appointment: appt });
  } catch (err) {
    next(err);
  }
});

// Shared guard for doctor-only status actions on their own appointment.
async function loadOwnedByDoctor(req: any, res: any) {
  const appt = await getAppointmentById(req.params.id);
  if (!appt) {
    res.status(404).json({ error: "appointment not found" });
    return null;
  }
  if (appt.doctor_id !== req.user.id) {
    res.status(403).json({ error: "not your appointment" });
    return null;
  }
  return appt;
}

// POST /api/appointments/:id/confirm — assigned doctor accepts a PENDING request.
appointmentsRouter.post("/:id/confirm", requireAuth, requireRole("DOCTOR"), writeLimit, async (req, res, next) => {
  try {
    const appt = await loadOwnedByDoctor(req, res);
    if (!appt) return;
    if (appt.status !== "PENDING") {
      return res.status(409).json({ error: `cannot confirm an appointment that is ${appt.status}` });
    }
    const appointment = await updateAppointmentStatus(appt.id, "CONFIRMED");
    res.json({ appointment });
  } catch (err) {
    next(err);
  }
});

// POST /api/appointments/:id/reject — assigned doctor declines a PENDING request.
appointmentsRouter.post("/:id/reject", requireAuth, requireRole("DOCTOR"), writeLimit, async (req, res, next) => {
  try {
    const appt = await loadOwnedByDoctor(req, res);
    if (!appt) return;
    if (appt.status !== "PENDING") {
      return res.status(409).json({ error: `cannot reject an appointment that is ${appt.status}` });
    }
    const appointment = await updateAppointmentStatus(appt.id, "REJECTED");
    res.json({ appointment });
  } catch (err) {
    next(err);
  }
});

// POST /api/appointments/:id/cancel — either participant may cancel while the
// appointment is still PENDING or CONFIRMED.
appointmentsRouter.post("/:id/cancel", requireAuth, writeLimit, async (req, res, next) => {
  try {
    const appt = await getAppointmentById(req.params.id);
    if (!appt) return res.status(404).json({ error: "appointment not found" });

    const u = req.user!;
    const isParticipant = appt.patient_id === u.id || appt.doctor_id === u.id;
    if (!isParticipant) return res.status(403).json({ error: "not your appointment" });
    if (!["PENDING", "CONFIRMED"].includes(appt.status)) {
      return res.status(409).json({ error: `cannot cancel an appointment that is ${appt.status}` });
    }
    const appointment = await updateAppointmentStatus(appt.id, "CANCELLED");
    res.json({ appointment });
  } catch (err) {
    next(err);
  }
});

// POST /api/appointments/:id/start — THE BRIDGE. The assigned doctor starts a
// CONFIRMED appointment: create a Visit (linked to the real patient + doctor),
// run the scribe pipeline on the transcript/audio, link the visit back, and mark
// the appointment COMPLETED. Returns the appointment, visit, and AI draft note.
appointmentsRouter.post("/:id/start", requireAuth, requireRole("DOCTOR"), writeLimit, upload.single("audio"), async (req, res, next) => {
  try {
    const appt = await loadOwnedByDoctor(req, res);
    if (!appt) return;
    if (appt.status !== "CONFIRMED") {
      return res.status(409).json({ error: `appointment must be CONFIRMED to start (currently ${appt.status})` });
    }
    if (appt.visit_id) {
      return res.status(409).json({ error: "appointment already has a visit" });
    }

    // Validate input BEFORE creating anything, so a bad request leaves no orphan.
    const transcript = req.body?.transcript;
    const hasTranscript = typeof transcript === "string" && transcript.trim().length > 0;
    if (!req.file && !hasTranscript) {
      return res.status(400).json({ error: "provide an audio file or a transcript" });
    }

    // Lazy import so this router (and its tests) don't need an OpenAI key unless
    // a visit is actually started.
    const { runPipeline, runPipelineFromAudio } = await import("../pipeline/run");

    const visit = await createVisit(newPatientRef(), {
      patientId: appt.patient_id,
      doctorId: appt.doctor_id,
    });

    const soap = req.file
      ? await runPipelineFromAudio(visit.id, req.file.buffer, req.file.originalname)
      : await runPipeline(visit.id, transcript);

    const appointment = await linkAppointmentVisit(appt.id, visit.id, "COMPLETED");
    const fullVisit = (await getVisit(visit.id)) ?? visit;
    res.status(201).json({ appointment, visit: fullVisit, note: soap });
  } catch (err) {
    next(err);
  }
});
