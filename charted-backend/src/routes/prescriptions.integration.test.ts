import "dotenv/config";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import express from "express";
import type { AddressInfo } from "node:net";
import type { Role } from "../lib/auth";
import type { SoapNote } from "../schema/soap";

const hasDb = !!process.env.DATABASE_URL;
const PREFIX = "phase4-test-";

const noteWithMeds: SoapNote = {
  chiefComplaint: "Sore throat",
  subjective: "3 days of sore throat",
  objective: "Pharyngeal erythema",
  assessment: "Acute pharyngitis",
  plan: "Supportive care + antibiotics",
  medications: ["Amoxicillin 500mg", "Ibuprofen"],
  allergies: [],
  vitals: { tempC: 38.1, hr: null, bp: null },
  icdCodes: [],
  flags: [],
};

describe.skipIf(!hasDb)("prescriptions (phase 4)", () => {
  let server: ReturnType<express.Application["listen"]>;
  let pool: typeof import("../db/pool").pool;
  let base = "";
  const tokens: Record<string, string> = {};
  const ids: Record<string, string> = {};
  let approvedVisitId = "";
  let draftVisitId = "";

  beforeAll(async () => {
    const { authRouter } = await import("./auth");
    const { prescriptionsRouter } = await import("./prescriptions");
    ({ pool } = await import("../db/pool"));
    const { createUser } = await import("../db/users");
    const { hashPassword, signToken } = await import("../lib/auth");
    const { createVisit, saveNoteVersion, setVisitStatus } = await import("../db/queries");

    await pool.query("delete from users where email like $1", [`${PREFIX}%`]);

    const makeUser = async (key: string, role: Role) => {
      const u = await createUser({
        name: key,
        email: `${PREFIX}${key}@example.com`,
        passwordHash: await hashPassword("password123"),
        role,
      });
      ids[key] = u.id;
      tokens[key] = signToken({ id: u.id, email: u.email, name: u.name, role: u.role });
    };
    await makeUser("patient", "PATIENT");
    await makeUser("patient2", "PATIENT");
    await makeUser("doctor", "DOCTOR");
    await makeUser("doctor2", "DOCTOR");

    const approved = await createVisit("SYN-P4", { patientId: ids.patient, doctorId: ids.doctor });
    approvedVisitId = approved.id;
    await saveNoteVersion(approvedVisitId, 1, noteWithMeds, "ai");
    await setVisitStatus(approvedVisitId, "approved");

    const draft = await createVisit("SYN-P4-DRAFT", { patientId: ids.patient, doctorId: ids.doctor });
    draftVisitId = draft.id;
    await saveNoteVersion(draftVisitId, 1, noteWithMeds, "ai");

    const app = express();
    app.use(express.json());
    app.use("/api/auth", authRouter);
    app.use("/api/prescriptions", prescriptionsRouter);
    app.use((err: unknown, _req: any, res: any, _next: any) => {
      res.status(500).json({ error: err instanceof Error ? err.message : "error" });
    });

    server = app.listen(0);
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterAll(async () => {
    await pool.query("delete from visits where id = any($1)", [[approvedVisitId, draftVisitId]]);
    await pool.query("delete from users where email like $1", [`${PREFIX}%`]);
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await pool.end();
  });

  const H = (key: string) => ({
    "Content-Type": "application/json",
    Authorization: `Bearer ${tokens[key]}`,
  });
  const issue = (key: string, body: object) =>
    fetch(`${base}/api/prescriptions`, { method: "POST", headers: H(key), body: JSON.stringify(body) });

  let rxId = "";

  it("cannot issue for a non-approved visit (409)", async () => {
    const res = await issue("doctor", { visitId: draftVisitId });
    expect(res.status).toBe(409);
  });

  it("a patient cannot issue a prescription (403)", async () => {
    const res = await issue("patient", { visitId: approvedVisitId });
    expect(res.status).toBe(403);
  });

  it("a non-owning doctor cannot issue for another doctor's visit (403)", async () => {
    const res = await issue("doctor2", { visitId: approvedVisitId });
    expect(res.status).toBe(403);
  });

  it("issuing without items auto-seeds from the approved note's medications (201)", async () => {
    const res = await issue("doctor", { visitId: approvedVisitId, notes: "Take with food" });
    expect(res.status).toBe(201);
    const b = (await res.json()) as any;
    const names = b.prescription.items.map((i: any) => i.name);
    expect(names).toEqual(["Amoxicillin 500mg", "Ibuprofen"]);
    expect(b.prescription.patient_id).toBe(ids.patient);
    expect(b.prescription.doctor_id).toBe(ids.doctor);
    rxId = b.prescription.id;
  });

  it("issuing with explicit items preserves dosage/frequency (201)", async () => {
    const res = await issue("doctor", {
      visitId: approvedVisitId,
      items: [{ name: "Amoxicillin", dosage: "500mg", frequency: "TID", duration: "7 days" }],
    });
    expect(res.status).toBe(201);
    const b = (await res.json()) as any;
    expect(b.prescription.items[0]).toMatchObject({ name: "Amoxicillin", dosage: "500mg", frequency: "TID" });
  });

  it("the patient sees their prescriptions; a stranger does not", async () => {
    const mine = (await (await fetch(`${base}/api/prescriptions`, { headers: H("patient") })).json()) as any;
    expect(mine.prescriptions.length).toBeGreaterThanOrEqual(2);

    const other = (await (await fetch(`${base}/api/prescriptions`, { headers: H("patient2") })).json()) as any;
    expect(other.prescriptions.length).toBe(0);
  });

  it("a participant can fetch one by id (200); a stranger cannot (403)", async () => {
    const ok = await fetch(`${base}/api/prescriptions/${rxId}`, { headers: H("patient") });
    expect(ok.status).toBe(200);
    const forbidden = await fetch(`${base}/api/prescriptions/${rxId}`, { headers: H("patient2") });
    expect(forbidden.status).toBe(403);
  });

  it("rejects unauthenticated access (401)", async () => {
    const res = await fetch(`${base}/api/prescriptions`);
    expect(res.status).toBe(401);
  });
});
