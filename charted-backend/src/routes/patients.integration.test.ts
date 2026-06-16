import "dotenv/config";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import express from "express";
import type { AddressInfo } from "node:net";
import type { Role } from "../lib/auth";
import type { SoapNote } from "../schema/soap";

const hasDb = !!process.env.DATABASE_URL;
const PREFIX = "phase5-test-";

const note: SoapNote = {
  chiefComplaint: "Persistent cough",
  subjective: "2 weeks of cough",
  objective: "Clear lungs",
  assessment: "Post-viral cough",
  plan: "Rest, fluids",
  medications: ["Dextromethorphan"],
  allergies: [],
  vitals: { tempC: null, hr: null, bp: null },
  icdCodes: [],
  flags: [],
};

describe.skipIf(!hasDb)("patient history (phase 5)", () => {
  let server: ReturnType<express.Application["listen"]>;
  let pool: typeof import("../db/pool").pool;
  let base = "";
  const tokens: Record<string, string> = {};
  const ids: Record<string, string> = {};
  let visitId = "";

  beforeAll(async () => {
    const { authRouter } = await import("./auth");
    const { patientsRouter } = await import("./patients");
    ({ pool } = await import("../db/pool"));
    const { createUser } = await import("../db/users");
    const { hashPassword, signToken } = await import("../lib/auth");
    const { createVisit, saveNoteVersion, setVisitStatus } = await import("../db/queries");
    const { createAppointment } = await import("../db/appointments");
    const { createPrescription } = await import("../db/prescriptions");

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

    const visit = await createVisit("SYN-P5", { patientId: ids.patient, doctorId: ids.doctor });
    visitId = visit.id;
    await saveNoteVersion(visitId, 1, note, "ai");
    await setVisitStatus(visitId, "approved");
    await createAppointment({
      patientId: ids.patient,
      doctorId: ids.doctor,
      scheduledAt: "2030-02-01T09:00:00.000Z",
      reason: "Follow-up",
    });
    await createPrescription({
      visitId,
      patientId: ids.patient,
      doctorId: ids.doctor,
      items: [{ name: "Dextromethorphan", dosage: "10ml" }],
    });

    const app = express();
    app.use(express.json());
    app.use("/api/auth", authRouter);
    app.use("/api/patients", patientsRouter);
    app.use((err: unknown, _req: any, res: any, _next: any) => {
      res.status(500).json({ error: err instanceof Error ? err.message : "error" });
    });

    server = app.listen(0);
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterAll(async () => {
    await pool.query("delete from visits where id = $1", [visitId]);
    await pool.query("delete from users where email like $1", [`${PREFIX}%`]);
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await pool.end();
  });

  const H = (key: string) => ({ Authorization: `Bearer ${tokens[key]}` });

  it("a patient reads their own chart via /me/history (200)", async () => {
    const res = await fetch(`${base}/api/patients/me/history`, { headers: H("patient") });
    expect(res.status).toBe(200);
    const b = (await res.json()) as any;
    expect(b.patient.email).toBe(`${PREFIX}patient@example.com`);
    expect(b.counts).toEqual({ visits: 1, appointments: 1, prescriptions: 1 });
  });

  it("the chart's visit carries the latest note summary", async () => {
    const b = (await (await fetch(`${base}/api/patients/me/history`, { headers: H("patient") })).json()) as any;
    expect(b.visits[0].chiefComplaint).toBe("Persistent cough");
    expect(b.visits[0].status).toBe("approved");
    expect(b.visits[0].doctorName).toBe("doctor");
  });

  it("the timeline merges all three event types, newest first", async () => {
    const b = (await (await fetch(`${base}/api/patients/me/history`, { headers: H("patient") })).json()) as any;
    const types = b.timeline.map((e: any) => e.type).sort();
    expect(types).toEqual(["appointment", "prescription", "visit"]);
    expect(b.timeline[0].type).toBe("appointment");
  });

  it("a doctor can read another patient's chart (200)", async () => {
    const res = await fetch(`${base}/api/patients/${ids.patient}/history`, { headers: H("doctor") });
    expect(res.status).toBe(200);
  });

  it("a different patient cannot read someone else's chart (403)", async () => {
    const res = await fetch(`${base}/api/patients/${ids.patient}/history`, { headers: H("patient2") });
    expect(res.status).toBe(403);
  });

  it("history for a non-patient id is 404", async () => {
    const res = await fetch(`${base}/api/patients/${ids.doctor}/history`, { headers: H("doctor") });
    expect(res.status).toBe(404);
  });

  it("the patient directory is DOCTOR/ADMIN-only", async () => {
    const ok = await fetch(`${base}/api/patients`, { headers: H("doctor") });
    expect(ok.status).toBe(200);
    const b = (await ok.json()) as any;
    expect(b.patients.some((p: any) => p.id === ids.patient)).toBe(true);

    const forbidden = await fetch(`${base}/api/patients`, { headers: H("patient") });
    expect(forbidden.status).toBe(403);
  });

  it("rejects unauthenticated access (401)", async () => {
    const res = await fetch(`${base}/api/patients/me/history`);
    expect(res.status).toBe(401);
  });
});
