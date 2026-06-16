import "dotenv/config";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import express from "express";
import type { AddressInfo } from "node:net";


const hasDb = !!process.env.DATABASE_URL;
const EMAIL = "phase1-auth-test@example.com";
const PASSWORD = "supersecret123";

describe.skipIf(!hasDb)("auth (phase 1)", () => {
  let server: ReturnType<express.Application["listen"]>;
  let pool: typeof import("../db/pool").pool;
  let base = "";

  beforeAll(async () => {
    const { authRouter } = await import("./auth");
    ({ pool } = await import("../db/pool"));

    await pool.query("delete from users where email = $1", [EMAIL]);

    const app = express();
    app.use(express.json());
    app.use("/api/auth", authRouter);
    app.use((err: unknown, _req: any, res: any, _next: any) => {
      res.status(500).json({ error: err instanceof Error ? err.message : "error" });
    });

    server = app.listen(0);
    const port = (server.address() as AddressInfo).port;
    base = `http://127.0.0.1:${port}`;
  });

  afterAll(async () => {
    await pool.query("delete from users where email = $1", [EMAIL]);
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await pool.end();
  });

  let token = "";

  it("registers a new user and returns a token (without the password hash)", async () => {
    const res = await fetch(`${base}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Phase One", email: EMAIL, password: PASSWORD, role: "DOCTOR" }),
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as any;
    expect(typeof body.token).toBe("string");
    expect(body.user.email).toBe(EMAIL);
    expect(body.user.role).toBe("DOCTOR");
    expect(body.user.password_hash).toBeUndefined();
  });

  it("rejects a too-short password with 400", async () => {
    const res = await fetch(`${base}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Bad", email: "x@example.com", password: "short" }),
    });
    expect(res.status).toBe(400);
  });

  it("rejects a duplicate email with 409", async () => {
    const res = await fetch(`${base}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Dupe", email: EMAIL, password: PASSWORD }),
    });
    expect(res.status).toBe(409);
  });

  it("rejects login with a wrong password (401)", async () => {
    const res = await fetch(`${base}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: EMAIL, password: "wrongpassword" }),
    });
    expect(res.status).toBe(401);
  });

  it("logs in with correct credentials and returns a token", async () => {
    const res = await fetch(`${base}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(typeof body.token).toBe("string");
    token = body.token;
  });

  it("rejects /me without a token (401)", async () => {
    const res = await fetch(`${base}/api/auth/me`);
    expect(res.status).toBe(401);
  });

  it("returns the current user from /me with a valid token", async () => {
    const res = await fetch(`${base}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.user.email).toBe(EMAIL);
  });
});
