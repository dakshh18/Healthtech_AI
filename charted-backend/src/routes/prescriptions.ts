import { Router } from "express";
import { z } from "zod";
import { requireAuth, requireRole } from "../lib/requireAuth";
import { rateLimit } from "../lib/rateLimit";
import { getVisit, getLatestNoteVersion } from "../db/queries";
import {
  createPrescription,
  getPrescriptionById,
  listPrescriptionsForPatient,
  listPrescriptionsForDoctor,
  listAllPrescriptions,
  type PrescriptionItem,
} from "../db/prescriptions";

export const prescriptionsRouter = Router();

const writeLimit = rateLimit(30, 60_000);

const itemSchema = z.object({
  name: z.string().trim().min(1).max(200),
  dosage: z.string().trim().max(100).optional(),
  frequency: z.string().trim().max(100).optional(),
  duration: z.string().trim().max(100).optional(),
  instructions: z.string().trim().max(500).optional(),
});

const issueSchema = z.object({
  visitId: z.string().uuid(),
  items: z.array(itemSchema).optional(),
  notes: z.string().trim().max(2000).optional(),
});


prescriptionsRouter.post("/", requireAuth, requireRole("DOCTOR", "ADMIN"), writeLimit, async (req, res, next) => {
  try {
    const parsed = issueSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "invalid prescription", details: parsed.error.flatten() });
    }
    const { visitId, items, notes } = parsed.data;

    const visit = await getVisit(visitId);
    if (!visit) return res.status(404).json({ error: "visit not found" });
    if (visit.status !== "approved") {
      return res.status(409).json({ error: "visit must be approved before issuing a prescription" });
    }
    if (req.user!.role === "DOCTOR" && visit.doctor_id && visit.doctor_id !== req.user!.id) {
      return res.status(403).json({ error: "not your visit" });
    }

    let resolvedItems: PrescriptionItem[] = items ?? [];
    if (resolvedItems.length === 0) {
      const latest = await getLatestNoteVersion(visitId);
      const meds = latest?.soap?.medications ?? [];
      resolvedItems = meds.map((name) => ({ name }));
    }
    if (resolvedItems.length === 0) {
      return res.status(400).json({
        error: "no medications to prescribe (none provided and none in the approved note)",
      });
    }

    const doctorId = req.user!.role === "DOCTOR" ? req.user!.id : visit.doctor_id ?? null;
    const prescription = await createPrescription({
      visitId,
      patientId: visit.patient_id ?? null,
      doctorId,
      items: resolvedItems,
      notes,
    });
    res.status(201).json({ prescription });
  } catch (err) {
    next(err);
  }
});

// GET /api/prescriptions — role-aware list.
prescriptionsRouter.get("/", requireAuth, async (req, res, next) => {
  try {
    const u = req.user!;
    const prescriptions =
      u.role === "ADMIN"
        ? await listAllPrescriptions()
        : u.role === "DOCTOR"
        ? await listPrescriptionsForDoctor(u.id)
        : await listPrescriptionsForPatient(u.id);
    res.json({ prescriptions });
  } catch (err) {
    next(err);
  }
});

// GET /api/prescriptions/:id — a participant (or admin) can view it.
prescriptionsRouter.get("/:id", requireAuth, async (req, res, next) => {
  try {
    const rx = await getPrescriptionById(req.params.id);
    if (!rx) return res.status(404).json({ error: "prescription not found" });

    const u = req.user!;
    const allowed = u.role === "ADMIN" || rx.patient_id === u.id || rx.doctor_id === u.id;
    if (!allowed) return res.status(403).json({ error: "not your prescription" });

    res.json({ prescription: rx });
  } catch (err) {
    next(err);
  }
});
