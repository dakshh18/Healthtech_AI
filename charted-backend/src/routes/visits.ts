import { Router } from "express";
import { runPipeline } from "../pipeline/run";
import { SoapNote } from "../schema/soap";
import { writeAudit } from "../lib/audit";
import { rateLimit } from "../lib/rateLimit";
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

// Generous cap; protects the write routes without getting in the way of demos.
const writeLimit = rateLimit(30, 60_000);

function newPatientRef(): string {
  return `SYN-${Math.floor(1000 + Math.random() * 9000)}`;
}

// POST /api/visits — v1 path: JSON { transcript, patientRef? } -> run pipeline.
// Audio upload is added in a later phase.
visitsRouter.post("/", writeLimit, async (req, res, next) => {
  try {
    const { transcript, patientRef } = req.body ?? {};
    if (typeof transcript !== "string" || transcript.trim().length === 0) {
      return res.status(400).json({ error: "transcript is required" });
    }

    const visit = await createVisit(patientRef ?? newPatientRef());
    const soap = await runPipeline(visit.id, transcript);

    res.status(201).json({ visit, note: soap });
  } catch (err) {
    next(err);
  }
});

// GET /api/visits — list for the sidebar
visitsRouter.get("/", async (_req, res, next) => {
  try {
    const visits = await listVisits();
    res.json({ visits });
  } catch (err) {
    next(err);
  }
});

// GET /api/visits/:id — visit + redacted transcript + latest note version
visitsRouter.get("/:id", async (req, res, next) => {
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

// PATCH /api/visits/:id/note — clinician edits create a new version (source
// "clinician"). This never finalizes; the visit stays a draft until approval.
visitsRouter.patch("/:id/note", writeLimit, async (req, res, next) => {
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

    const author = typeof req.body?.author === "string" ? req.body.author : "clinician";
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
visitsRouter.post("/:id/approve", writeLimit, async (req, res, next) => {
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

    const actor = typeof req.body?.actor === "string" ? req.body.actor : "clinician";
    const updated = await setVisitStatus(visit.id, "approved");
    await writeAudit(visit.id, "approved", actor, { approvedVersion: latest.version_no });

    res.json({ visit: updated });
  } catch (err) {
    next(err);
  }
});

// GET /api/visits/:id/versions — full version history + audit trail
visitsRouter.get("/:id/versions", async (req, res, next) => {
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
