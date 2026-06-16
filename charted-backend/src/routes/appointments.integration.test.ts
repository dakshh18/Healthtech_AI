import "dotenv/config";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import express from "express";
import type { AddressInfo } from "node:net";
import type { Role } from "../lib/auth";


const hasDb = !!process.env.DATABASE_URL;
const PREFIX = "phase3-test-";
const FUTURE = "2030-01-01T10:00:00.000Z";

describe.skipIf(!hasDb)("appointments (phase 3)", () => {
  let server: ReturnType<express.Application["listen"]>;
  let pool: typeof import("../db/pool").pool;
  let base = "";
  const tokens: Record<string, string> = {};
  const ids: Record<string, string> = {};
  let createdVisitId = "";

  beforeAll(async () => {
    const { authRouter } = await import("./auth");
    const { appointmentsRouter } = await import("./appointments");
    ({ pool } = await import("../db/pool"));
    const { createUser } = await import("../db/users");
    const { hashPassword, signToken } = await import("../lib/auth");

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

    const app = express();
    app.use(express.json());
    app.use("/api/auth", authRouter);
    app.use("/api/appointments", appointmentsRouter);
    app.use((err: unknown, _req: any, res: any, _next: any) => {
      res.status(500).json({ error: err instanceof Error ? err.message : "error" });
    });

    server = app.listen(0);
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterAll(async () => {
    if (createdVisitId) await pool.query("delete from visits where id = $1", [createdVisitId]);
    await pool.query("delete from users where email like $1", [`${PREFIX}%`]);
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await pool.end();
  });

  const H = (key: string) => ({
    "Content-Type": "application/json",
    Authorization: `Bearer ${tokens[key]}`,
  });
  const book = (key: string, body: object) =>
    fetch(`${base}/api/appointments`, { method: "POST", headers: H(key), body: JSON.stringify(body) });

  let apptId = "";

  it("a patient books an appointment (201, PENDING)", async () => {
    const res = await book("patient", { doctorId: ids.doctor, scheduledAt: FUTURE, reason: "Chest pain" });
    expect(res.status).toBe(201);
    const b = (await res.json()) as any;
    expect(b.appointment.status).toBe("PENDING");
    expect(b.appointment.doctor_id).toBe(ids.doctor);
    apptId = b.appointment.id;
  });

  it("a doctor cannot book (403)", async () => {
    const res = await book("doctor", { doctorId: ids.doctor, scheduledAt: FUTURE });
    expect(res.status).toBe(403);
  });

  it("booking with a non-doctor doctorId is rejected (400)", async () => {
    const res = await book("patient", { doctorId: ids.patient2, scheduledAt: FUTURE });
    expect(res.status).toBe(400);
  });

  it("patient and assigned doctor each see it (with names)", async () => {
    const pl = (await (await fetch(`${base}/api/appointments`, { headers: H("patient") })).json()) as any;
    expect(pl.appointments.some((a: any) => a.id === apptId)).toBe(true);
    const dl = (await (await fetch(`${base}/api/appointments`, { headers: H("doctor") })).json()) as any;
    const mine = dl.appointments.find((a: any) => a.id === apptId);
    expect(mine.patient_name).toBe("patient");
    expect(mine.doctor_name).toBe("doctor");
  });

  it("an unrelated patient cannot view it (403); unauthenticated (401)", async () => {
    const r403 = await fetch(`${base}/api/appointments/${apptId}`, { headers: H("patient2") });
    expect(r403.status).toBe(403);
    const r401 = await fetch(`${base}/api/appointments/${apptId}`);
    expect(r401.status).toBe(401);
  });

  it("the wrong doctor cannot confirm (403)", async () => {
    const res = await fetch(`${base}/api/appointments/${apptId}/confirm`, { method: "POST", headers: H("doctor2") });
    expect(res.status).toBe(403);
  });

  it("the assigned doctor confirms (200, CONFIRMED)", async () => {
    const res = await fetch(`${base}/api/appointments/${apptId}/confirm`, { method: "POST", headers: H("doctor") });
    expect(res.status).toBe(200);
    expect(((await res.json()) as any).appointment.status).toBe("CONFIRMED");
  });

  it("rejecting an already-confirmed appointment fails (409)", async () => {
    const res = await fetch(`${base}/api/appointments/${apptId}/reject`, { method: "POST", headers: H("doctor") });
    expect(res.status).toBe(409);
  });

  it("starting without a transcript or audio fails (400) and creates no visit", async () => {
    const res = await fetch(`${base}/api/appointments/${apptId}/start`, {
      method: "POST",
      headers: H("doctor"),
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
    const appt = ((await (await fetch(`${base}/api/appointments/${apptId}`, { headers: H("doctor") })).json()) as any).appointment;
    expect(appt.status).toBe("CONFIRMED");
    expect(appt.visit_id).toBeNull();
  });

  it("cannot start an appointment that is not CONFIRMED (409)", async () => {
    const b = (await (await book("patient", { doctorId: ids.doctor, scheduledAt: FUTURE })).json()) as any;
    const res = await fetch(`${base}/api/appointments/${b.appointment.id}/start`, {
      method: "POST",
      headers: H("doctor"),
      body: JSON.stringify({ transcript: "should not get here" }),
    });
    expect(res.status).toBe(409);
  });

  it("a participant can cancel a pending appointment (200, CANCELLED)", async () => {
    const b = (await (await book("patient", { doctorId: ids.doctor, scheduledAt: FUTURE })).json()) as any;
    const res = await fetch(`${base}/api/appointments/${b.appointment.id}/cancel`, { method: "POST", headers: H("patient") });
    expect(res.status).toBe(200);
    expect(((await res.json()) as any).appointment.status).toBe("CANCELLED");
  });

  it("linking a visit bridges appointment -> visit (query layer)", async () => {
    const { createVisit } = await import("../db/queries");
    const { linkAppointmentVisit } = await import("../db/appointments");
    const visit = await createVisit("SYN-P3", { patientId: ids.patient, doctorId: ids.doctor });
    createdVisitId = visit.id;
    const updated = await linkAppointmentVisit(apptId, visit.id, "COMPLETED");
    expect(updated?.visit_id).toBe(visit.id);
    expect(updated?.status).toBe("COMPLETED");
  });
});
