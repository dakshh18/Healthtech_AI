import "dotenv/config";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import express from "express";
import type { AddressInfo } from "node:net";
import type { Role } from "../lib/auth";

const hasDb = !!process.env.DATABASE_URL;
const PREFIX = "phase6-test-";
const MISSING_ID = "00000000-0000-0000-0000-000000000000";

describe.skipIf(!hasDb)("admin dashboard (phase 6)", () => {
  let server: ReturnType<express.Application["listen"]>;
  let pool: typeof import("../db/pool").pool;
  let base = "";
  const tokens: Record<string, string> = {};
  const ids: Record<string, string> = {};

  beforeAll(async () => {
    const { authRouter } = await import("./auth");
    const { adminRouter } = await import("./admin");
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
    await makeUser("admin", "ADMIN");
    await makeUser("doctor", "DOCTOR");
    await makeUser("promote", "PATIENT"); // will be promoted to DOCTOR
    await makeUser("victim", "PATIENT"); // will be deactivated

    const app = express();
    app.use(express.json());
    app.use("/api/auth", authRouter);
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

  const H = (key: string) => ({
    "Content-Type": "application/json",
    Authorization: `Bearer ${tokens[key]}`,
  });

  it("blocks non-admins (403) and unauthenticated (401)", async () => {
    expect((await fetch(`${base}/api/admin/stats`, { headers: H("doctor") })).status).toBe(403);
    expect((await fetch(`${base}/api/admin/stats`)).status).toBe(401);
  });

  it("lists users, filters by role, and never leaks the password hash", async () => {
    const all = (await (await fetch(`${base}/api/admin/users`, { headers: H("admin") })).json()) as any;
    expect(all.users.length).toBeGreaterThanOrEqual(4);
    expect(all.users[0].password_hash).toBeUndefined();

    const docs = (await (await fetch(`${base}/api/admin/users?role=DOCTOR`, { headers: H("admin") })).json()) as any;
    expect(docs.users.every((u: any) => u.role === "DOCTOR")).toBe(true);
  });

  it("gets one user (200) and 404s a missing id", async () => {
    expect((await fetch(`${base}/api/admin/users/${ids.doctor}`, { headers: H("admin") })).status).toBe(200);
    expect((await fetch(`${base}/api/admin/users/${MISSING_ID}`, { headers: H("admin") })).status).toBe(404);
  });

  it("promotes a patient to DOCTOR (200)", async () => {
    const res = await fetch(`${base}/api/admin/users/${ids.promote}/role`, {
      method: "PATCH",
      headers: H("admin"),
      body: JSON.stringify({ role: "DOCTOR" }),
    });
    expect(res.status).toBe(200);
    expect(((await res.json()) as any).user.role).toBe("DOCTOR");
  });

  it("refuses to let an admin change their own role (400)", async () => {
    const res = await fetch(`${base}/api/admin/users/${ids.admin}/role`, {
      method: "PATCH",
      headers: H("admin"),
      body: JSON.stringify({ role: "PATIENT" }),
    });
    expect(res.status).toBe(400);
  });

  it("deactivates an account, which then cannot log in (403), and can be reactivated", async () => {
    const login = () =>
      fetch(`${base}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: `${PREFIX}victim@example.com`, password: "password123" }),
      });

    expect((await login()).status).toBe(200); // active first

    const deact = await fetch(`${base}/api/admin/users/${ids.victim}/status`, {
      method: "PATCH",
      headers: H("admin"),
      body: JSON.stringify({ isActive: false }),
    });
    expect(deact.status).toBe(200);
    expect(((await deact.json()) as any).user.is_active).toBe(false);

    expect((await login()).status).toBe(403); // blocked while deactivated

    await fetch(`${base}/api/admin/users/${ids.victim}/status`, {
      method: "PATCH",
      headers: H("admin"),
      body: JSON.stringify({ isActive: true }),
    });
    expect((await login()).status).toBe(200); // reactivated
  });

  it("refuses to let an admin change their own status (400)", async () => {
    const res = await fetch(`${base}/api/admin/users/${ids.admin}/status`, {
      method: "PATCH",
      headers: H("admin"),
      body: JSON.stringify({ isActive: false }),
    });
    expect(res.status).toBe(400);
  });

  it("returns dashboard stats", async () => {
    const res = await fetch(`${base}/api/admin/stats`, { headers: H("admin") });
    expect(res.status).toBe(200);
    const b = (await res.json()) as any;
    expect(typeof b.stats.usersByRole).toBe("object");
    expect(b.stats.usersByRole.ADMIN).toBeGreaterThanOrEqual(1);
    expect(typeof b.stats.prescriptions).toBe("number");
  });

  it("returns the system-wide audit feed", async () => {
    const res = await fetch(`${base}/api/admin/audit?limit=10`, { headers: H("admin") });
    expect(res.status).toBe(200);
    const b = (await res.json()) as any;
    expect(Array.isArray(b.audit)).toBe(true);
  });
});
