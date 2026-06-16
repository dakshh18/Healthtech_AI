import "dotenv/config";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import express from "express";
import type { AddressInfo } from "node:net";
import type { Role } from "../lib/auth";


const hasDb = !!process.env.DATABASE_URL;
const PREFIX = "phase2-test-";

describe.skipIf(!hasDb)("doctors & admin (phase 2)", () => {
  let server: ReturnType<express.Application["listen"]>;
  let pool: typeof import("../db/pool").pool;
  let base = "";
  const tokens: Record<Role, string> = { DOCTOR: "", PATIENT: "", ADMIN: "" };

  beforeAll(async () => {
    const { authRouter } = await import("./auth");
    const { doctorsRouter } = await import("./doctors");
    const { adminRouter } = await import("./admin");
    ({ pool } = await import("../db/pool"));
    const { createUser } = await import("../db/users");
    const { hashPassword, signToken } = await import("../lib/auth");

    await pool.query("delete from users where email like $1", [`${PREFIX}%`]);

    const makeUser = async (role: Role) => {
      const email = `${PREFIX}${role.toLowerCase()}@example.com`;
      const u = await createUser({
        name: `${role} P2`,
        email,
        passwordHash: await hashPassword("password123"),
        role,
      });
      tokens[role] = signToken({ id: u.id, email: u.email, name: u.name, role: u.role });
    };
    await makeUser("DOCTOR");
    await makeUser("PATIENT");
    await makeUser("ADMIN");

    const app = express();
    app.use(express.json());
    app.use("/api/auth", authRouter);
    app.use("/api/doctors", doctorsRouter);
    app.use("/api/admin", adminRouter);
    app.use((err: unknown, _req: any, res: any, _next: any) => {
      res.status(500).json({ error: err instanceof Error ? err.message : "error" });
    });

    server = app.listen(0);
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterAll(async () => {
    await pool.query("delete from users where email like $1", [`${PREFIX}%`]);
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await pool.end();
  });

  const headers = (role: Role) => ({
    "Content-Type": "application/json",
    Authorization: `Bearer ${tokens[role]}`,
  });

  it("rejects unauthenticated access to the doctor directory (401)", async () => {
    const res = await fetch(`${base}/api/doctors`);
    expect(res.status).toBe(401);
  });

  it("a doctor creates their profile (201)", async () => {
    const res = await fetch(`${base}/api/doctors/me`, {
      method: "POST",
      headers: headers("DOCTOR"),
      body: JSON.stringify({ specialization: "Cardiology", experienceYears: 8, qualification: "MD" }),
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as any;
    expect(body.doctor.specialization).toBe("Cardiology");
    expect(body.doctor.experience_years).toBe(8);
  });

  it("rejects a duplicate profile create (409)", async () => {
    const res = await fetch(`${base}/api/doctors/me`, {
      method: "POST",
      headers: headers("DOCTOR"),
      body: JSON.stringify({ specialization: "Cardiology" }),
    });
    expect(res.status).toBe(409);
  });

  it("a patient cannot create a doctor profile (403)", async () => {
    const res = await fetch(`${base}/api/doctors/me`, {
      method: "POST",
      headers: headers("PATIENT"),
      body: JSON.stringify({ specialization: "Anything" }),
    });
    expect(res.status).toBe(403);
  });

  it("a partial PATCH updates one field without resetting others", async () => {
    const res = await fetch(`${base}/api/doctors/me`, {
      method: "PATCH",
      headers: headers("DOCTOR"),
      body: JSON.stringify({ experienceYears: 12 }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.doctor.experience_years).toBe(12);
    expect(body.doctor.specialization).toBe("Cardiology"); // unchanged
  });

  it("any authenticated user can browse doctors and see the new one", async () => {
    const res = await fetch(`${base}/api/doctors`, { headers: headers("PATIENT") });
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.doctors.some((d: any) => d.specialization === "Cardiology")).toBe(true);
  });

  it("admin can list users (200) but a doctor cannot (403)", async () => {
    const ok = await fetch(`${base}/api/admin/users`, { headers: headers("ADMIN") });
    expect(ok.status).toBe(200);
    const body = (await ok.json()) as any;
    expect(Array.isArray(body.users)).toBe(true);
    expect(body.users[0]?.password_hash).toBeUndefined();

    const forbidden = await fetch(`${base}/api/admin/users`, { headers: headers("DOCTOR") });
    expect(forbidden.status).toBe(403);
  });
});
