import { Router } from "express";
import multer from "multer";
import { runPipeline, runPipelineFromAudio } from "../pipeline/run";
import { SoapNote } from "../schema/soap";
import { writeAudit } from "../lib/audit";
import { rateLimit } from "../lib/rateLimit";
import { requireAuth, requireRole } from "../lib/requireAuth";
import { getUserById } from "../db/users";
import {
  createVisit,
  getVisit,
  listVisits,
  getRedactedTranscript,
  getLatestNoteVersion,
  getNextVersionNo,
  listNoteVersions,
  setVisitStatus,
  saveNoteVersion,
  listAudit,
} from "../db/queries";

export const visitsRouter = Router();

const writeLimit = rateLimit(30, 60_000);
const clinician = requireRole("DOCTOR", "ADMIN");

// Whisper accepts files up to 25MB; memory storage since we never persist audio.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
});

function newPatientRef(): string {
  return `SYN-${Math.floor(1000 + Math.random() * 9000)}`;
}
visitsRouter.post("/", requireAuth, clinician, writeLimit, upload.single("audio"), async (req, res, next) => {
  try {
    const patientRef =
      typeof req.body?.patientRef === "string" ? req.body.patientRef : newPatientRef();

    let patientId: string | null = null;
    if (typeof req.body?.patientId === "string" && req.body.patientId.length > 0) {
      const patient = await getUserById(req.body.patientId);
      if (!patient || patient.role !== "PATIENT") {
        return res.status(400).json({ error: "patientId must reference an existing PATIENT user" });
      }
      patientId = patient.id;
    }
    const doctorId = req.user!.role === "DOCTOR" ? req.user!.id : null;

    if (req.file) {
      const visit = await createVisit(patientRef, { patientId, doctorId });
      const soap = await runPipelineFromAudio(visit.id, req.file.buffer, req.file.originalname);
      const updated = (await getVisit(visit.id)) ?? visit;
      return res.status(201).json({ visit: updated, note: soap });
    }

    const transcript = req.body?.transcript;
    if (typeof transcript !== "string" || transcript.trim().length === 0) {
      return res.status(400).json({ error: "provide an audio file or a transcript" });
    }

    const visit = await createVisit(patientRef, { patientId, doctorId });
    const soap = await runPipeline(visit.id, transcript);
    res.status(201).json({ visit, note: soap });
  } catch (err) {
    next(err);
  }
});

// GET /api/visits — list for the sidebar
visitsRouter.get("/", requireAuth, async (_req, res, next) => {
  try {
    const visits = await listVisits();
    res.json({ visits });
  } catch (err) {
    next(err);
  }
});

// GET /api/visits/:id — visit + redacted transcript + latest note version
visitsRouter.get("/:id", requireAuth, async (req, res, next) => {
  try {
    const visit = await getVisit(req.params.id);
    if (!visit) return res.status(404).json({ error: "visit not found" });

    const [redactedTranscript, latest] = await Promise.all([
      getRedactedTranscript(visit.id),
      getLatestNoteVersion(visit.id),
    ]);

    res.json({
      visit,
      redactedTranscript,
      note: latest
        ? { soap: latest.soap, version: latest.version_no, source: latest.source }
        : null,
    });
  } catch (err) {
    next(err);
  }
});

visitsRouter.patch("/:id/note", requireAuth, clinician, writeLimit, async (req, res, next) => {
  try {
    const visit = await getVisit(req.params.id);
    if (!visit) return res.status(404).json({ error: "visit not found" });
    if (visit.status === "approved") {
      return res.status(409).json({ error: "visit is approved and can no longer be edited" });
    }

    const parsed = SoapNote.safeParse(req.body?.soap);
    if (!parsed.success) {
      return res.status(400).json({ error: "invalid soap note", details: parsed.error.flatten() });
    }

    const author = req.user!.name;
    const versionNo = await getNextVersionNo(visit.id);
    const version = await saveNoteVersion(visit.id, versionNo, parsed.data, "clinician", author);
    await writeAudit(visit.id, "edited", author, { versionNo });

    res.json({
      note: { soap: version.soap, version: version.version_no, source: version.source },
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/visits/:id/approve — the ONLY route that finalizes a visit.
visitsRouter.post("/:id/approve", requireAuth, clinician, writeLimit, async (req, res, next) => {
  try {
    const visit = await getVisit(req.params.id);
    if (!visit) return res.status(404).json({ error: "visit not found" });
    if (visit.status === "approved") {
      return res.status(409).json({ error: "visit already approved" });
    }

    const latest = await getLatestNoteVersion(visit.id);
    if (!latest) {
      return res.status(400).json({ error: "no note version to approve" });
    }

    const actor = req.user!.name;
    const updated = await setVisitStatus(visit.id, "approved");
    await writeAudit(visit.id, "approved", actor, { approvedVersion: latest.version_no });

    res.json({ visit: updated });
  } catch (err) {
    next(err);
  }
});

// GET /api/visits/:id/versions — full version history + audit trail
visitsRouter.get("/:id/versions", requireAuth, async (req, res, next) => {
  try {
    const visit = await getVisit(req.params.id);
    if (!visit) return res.status(404).json({ error: "visit not found" });

    const [versions, audit] = await Promise.all([
      listNoteVersions(visit.id),
      listAudit(visit.id),
    ]);

    res.json({
      versions: versions.map((v) => ({
        version: v.version_no,
        source: v.source,
        author: v.author,
        createdAt: v.created_at,
        soap: v.soap,
      })),
      audit: audit.map((a) => ({
        action: a.action,
        actor: a.actor,
        detail: a.detail,
        createdAt: a.created_at,
      })),
    });
  } catch (err) {
    next(err);
  }
});
