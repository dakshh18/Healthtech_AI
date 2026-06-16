import { Router } from "express";
import { requireAuth, requireRole } from "../lib/requireAuth";
import { getUserById, listPatients, toPublicUser } from "../db/users";
import { listVisitsForPatient } from "../db/queries";
import { listAppointmentsForPatient } from "../db/appointments";
import { listPrescriptionsForPatient } from "../db/prescriptions";

export const patientsRouter = Router();

type TimelineEvent = {
  type: "appointment" | "visit" | "prescription";
  at: string;
  status: string | null;
  title: string;
  refId: string;
};

// GET /api/patients — DOCTOR/ADMIN browse the patient directory.
patientsRouter.get("/", requireAuth, requireRole("DOCTOR", "ADMIN"), async (_req, res, next) => {
  try {
    const patients = (await listPatients()).map(toPublicUser);
    res.json({ patients });
  } catch (err) {
    next(err);
  }
});

// GET /api/patients/:id/history — a patient's full chart. `:id` may be "me".
// Patients can only read their own; doctors/admins can read any.
patientsRouter.get("/:id/history", requireAuth, async (req, res, next) => {
  try {
    const targetId = req.params.id === "me" ? req.user!.id : req.params.id;

    if (req.user!.role === "PATIENT" && targetId !== req.user!.id) {
      return res.status(403).json({ error: "not your record" });
    }

    const patient = await getUserById(targetId);
    if (!patient || patient.role !== "PATIENT") {
      return res.status(404).json({ error: "patient not found" });
    }

    const [visits, appointments, prescriptions] = await Promise.all([
      listVisitsForPatient(targetId),
      listAppointmentsForPatient(targetId),
      listPrescriptionsForPatient(targetId),
    ]);

    const timeline: TimelineEvent[] = [
      ...appointments.map((a) => ({
        type: "appointment" as const,
        at: a.scheduled_at,
        status: a.status,
        title: a.reason ?? "Appointment",
        refId: a.id,
      })),
      ...visits.map((v) => ({
        type: "visit" as const,
        at: v.created_at,
        status: v.status,
        title: v.latest_soap?.chiefComplaint ?? "Visit",
        refId: v.id,
      })),
      ...prescriptions.map((rx) => ({
        type: "prescription" as const,
        at: rx.created_at,
        status: null,
        title: `${rx.items.length} medication(s)`,
        refId: rx.id,
      })),
    ].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

    res.json({
      patient: toPublicUser(patient),
      counts: {
        visits: visits.length,
        appointments: appointments.length,
        prescriptions: prescriptions.length,
      },
      timeline,
      visits: visits.map((v) => ({
        id: v.id,
        status: v.status,
        createdAt: v.created_at,
        doctorName: v.doctor_name,
        chiefComplaint: v.latest_soap?.chiefComplaint ?? null,
        assessment: v.latest_soap?.assessment ?? null,
        latestVersion: v.latest_version,
      })),
      appointments,
      prescriptions,
    });
  } catch (err) {
    next(err);
  }
});
