import "dotenv/config";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { AddressInfo } from "node:net";
import type { SoapNote } from "../schema/soap";


const hasEnv = !!process.env.DATABASE_URL && !!process.env.OPENAI_API_KEY;
const DOCTOR_EMAIL = "visit-workflow-test-doctor@example.com";

const sampleSoap: SoapNote = {
  chiefComplaint: "Sore throat",
  subjective: "3 days of sore throat",
  objective: "Pharyngeal erythema",
  assessment: "Acute pharyngitis",
  plan: "Supportive care",
  medications: ["acetaminophen"],
  allergies: [],
  vitals: { tempC: 38.1, hr: null, bp: null },
  icdCodes: [
    { code: "J02.9", description: "Acute pharyngitis", confidence: 0.8, rationale: "stated" },
  ],
  flags: [],
};

describe.skipIf(!hasEnv)("visit approval workflow", () => {
  let server: ReturnType<typeof import("../app").app.listen>;
  let pool: typeof import("../db/pool").pool;
  let base = "";
  let visitId = "";
  let authHeaders: Record<string, string> = {};

  beforeAll(async () => {
    const { app } = await import("../app");
    ({ pool } = await import("../db/pool"));
    const { createVisit, saveNoteVersion } = await import("../db/queries");
    const { createUser } = await import("../db/users");
    const { hashPassword, signToken } = await import("../lib/auth");

    await pool.query("delete from users where email = $1", [DOCTOR_EMAIL]);
    const doctor = await createUser({
      name: "Dr. Test",
      email: DOCTOR_EMAIL,
      passwordHash: await hashPassword("password123"),
      role: "DOCTOR",
    });
    const token = signToken({
      id: doctor.id,
      email: doctor.email,
      name: doctor.name,
      role: doctor.role,
    });
    authHeaders = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };

    server = app.listen(0);
    const port = (server.address() as AddressInfo).port;
    base = `http://127.0.0.1:${port}`;

    const visit = await createVisit("SYN-TEST", { doctorId: doctor.id });
    visitId = visit.id;
    await saveNoteVersion(visitId, 1, sampleSoap, "ai");
  });

  afterAll(async () => {
    await pool.query("delete from visits where id = $1", [visitId]);
    await pool.query("delete from users where email = $1", [DOCTOR_EMAIL]);
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await pool.end();
  });

  it("rejects an unauthenticated request (401)", async () => {
    const res = await fetch(`${base}/api/visits/${visitId}`);
    expect(res.status).toBe(401);
  });

  it("a clinician edit creates a v2 'clinician' version and does NOT finalize", async () => {
    const res = await fetch(`${base}/api/visits/${visitId}/note`, {
      method: "PATCH",
      headers: authHeaders,
      body: JSON.stringify({ soap: { ...sampleSoap, assessment: "edited by clinician" } }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.note.version).toBe(2);
    expect(body.note.source).toBe("clinician");

    const get = (await (await fetch(`${base}/api/visits/${visitId}`, { headers: authHeaders })).json()) as any;
    expect(get.visit.status).toBe("draft");
  });

  it("only the approve route flips status to approved", async () => {
    const res = await fetch(`${base}/api/visits/${visitId}/approve`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.visit.status).toBe("approved");
  });

  it("rejects edits once approved", async () => {
    const res = await fetch(`${base}/api/visits/${visitId}/note`, {
      method: "PATCH",
      headers: authHeaders,
      body: JSON.stringify({ soap: sampleSoap }),
    });
    expect(res.status).toBe(409);
  });

  it("rejects a create with neither audio nor transcript", async () => {
    const res = await fetch(`${base}/api/visits`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  });

  it("records the full version history and audit trail", async () => {
    const res = (await (await fetch(`${base}/api/visits/${visitId}/versions`, { headers: authHeaders })).json()) as any;
    expect(res.versions.map((v: { version: number }) => v.version)).toEqual([1, 2]);
    expect(res.versions[0].source).toBe("ai");
    expect(res.versions[1].source).toBe("clinician");

    const actions = res.audit.map((a: { action: string }) => a.action);
    expect(actions).toContain("edited");
    expect(actions).toContain("approved");
  });
});
