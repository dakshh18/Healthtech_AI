import { pool } from "./pool";
import type { SoapNote } from "../schema/soap";
import type { Demographics } from "../pipeline/demographics";

export type VisitRow = {
  id: string;
  patient_ref: string;
  status: string;
  audio_seconds: number | null;
  demographics: Demographics | null;
  patient_id: string | null;
  doctor_id: string | null;
  created_at: string;
};

export type NoteVersionRow = {
  id: string;
  visit_id: string;
  version_no: number;
  soap: SoapNote;
  source: string;
  author: string;
  created_at: string;
};

export type AuditRow = {
  id: string;
  visit_id: string;
  action: string;
  actor: string;
  detail: unknown;
  created_at: string;
};

export async function createVisit(
  patientRef: string,
  opts: {
    audioSeconds?: number | null;
    patientId?: string | null;
    doctorId?: string | null;
  } = {}
): Promise<VisitRow> {
  const { rows } = await pool.query<VisitRow>(
    `insert into visits (patient_ref, audio_seconds, patient_id, doctor_id)
     values ($1, $2, $3, $4) returning *`,
    [patientRef, opts.audioSeconds ?? null, opts.patientId ?? null, opts.doctorId ?? null]
  );
  return rows[0];
}

export async function setAudioSeconds(
  visitId: string,
  seconds: number
): Promise<void> {
  await pool.query(`update visits set audio_seconds = $2 where id = $1`, [
    visitId,
    seconds,
  ]);
}

export async function setDemographics(
  visitId: string,
  demographics: Demographics
): Promise<void> {
  await pool.query(`update visits set demographics = $2 where id = $1`, [
    visitId,
    JSON.stringify(demographics),
  ]);
}

export async function saveTranscript(
  visitId: string,
  rawText: string,
  redactedText: string
): Promise<void> {
  await pool.query(
    `insert into transcripts (visit_id, raw_text, redacted_text) values ($1, $2, $3)`,
    [visitId, rawText, redactedText]
  );
}

export async function saveNoteVersion(
  visitId: string,
  versionNo: number,
  soap: SoapNote,
  source: "ai" | "clinician",
  author = "system"
): Promise<NoteVersionRow> {
  const { rows } = await pool.query<NoteVersionRow>(
    `insert into note_versions (visit_id, version_no, soap, source, author)
     values ($1, $2, $3, $4, $5) returning *`,
    [visitId, versionNo, JSON.stringify(soap), source, author]
  );
  return rows[0];
}

export async function getVisit(visitId: string): Promise<VisitRow | null> {
  const { rows } = await pool.query<VisitRow>(
    `select * from visits where id = $1`,
    [visitId]
  );
  return rows[0] ?? null;
}

export async function listVisits(): Promise<VisitRow[]> {
  const { rows } = await pool.query<VisitRow>(
    `select id, patient_ref, status, audio_seconds, demographics, patient_id, doctor_id, created_at
     from visits order by created_at desc`
  );
  return rows;
}

// A patient's visits, each with its latest note summary and the doctor's name.
// Used to build the patient history chart (Phase 5).
export type PatientVisitRow = {
  id: string;
  status: string;
  created_at: string;
  doctor_id: string | null;
  doctor_name: string | null;
  latest_soap: SoapNote | null;
  latest_version: number | null;
};

export async function listVisitsForPatient(
  patientId: string
): Promise<PatientVisitRow[]> {
  const { rows } = await pool.query<PatientVisitRow>(
    `select v.id, v.status, v.created_at, v.doctor_id,
            d.name as doctor_name,
            nv.soap as latest_soap, nv.version_no as latest_version
     from visits v
     left join users d on d.id = v.doctor_id
     left join lateral (
       select soap, version_no from note_versions
       where visit_id = v.id order by version_no desc limit 1
     ) nv on true
     where v.patient_id = $1
     order by v.created_at desc`,
    [patientId]
  );
  return rows;
}

export async function getRedactedTranscript(
  visitId: string
): Promise<string | null> {
  const { rows } = await pool.query<{ redacted_text: string }>(
    `select redacted_text from transcripts
     where visit_id = $1 order by created_at desc limit 1`,
    [visitId]
  );
  return rows[0]?.redacted_text ?? null;
}

export async function getLatestNoteVersion(
  visitId: string
): Promise<NoteVersionRow | null> {
  const { rows } = await pool.query<NoteVersionRow>(
    `select * from note_versions
     where visit_id = $1 order by version_no desc limit 1`,
    [visitId]
  );
  return rows[0] ?? null;
}

export async function getNextVersionNo(visitId: string): Promise<number> {
  const { rows } = await pool.query<{ max: number | null }>(
    `select max(version_no) as max from note_versions where visit_id = $1`,
    [visitId]
  );
  return (rows[0].max ?? 0) + 1;
}

export async function listNoteVersions(
  visitId: string
): Promise<NoteVersionRow[]> {
  const { rows } = await pool.query<NoteVersionRow>(
    `select * from note_versions where visit_id = $1 order by version_no asc`,
    [visitId]
  );
  return rows;
}

export async function setVisitStatus(
  visitId: string,
  status: "draft" | "approved"
): Promise<VisitRow | null> {
  const { rows } = await pool.query<VisitRow>(
    `update visits set status = $2 where id = $1 returning *`,
    [visitId, status]
  );
  return rows[0] ?? null;
}

export async function listAudit(visitId: string): Promise<AuditRow[]> {
  const { rows } = await pool.query<AuditRow>(
    `select * from audit_log where visit_id = $1 order by created_at asc, id asc`,
    [visitId]
  );
  return rows;
}

// System-wide activity feed for the admin dashboard (Phase 6).
export async function listRecentAudit(limit = 50): Promise<AuditRow[]> {
  const { rows } = await pool.query<AuditRow>(
    `select * from audit_log order by created_at desc, id desc limit $1`,
    [limit]
  );
  return rows;
}
