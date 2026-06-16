"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Logo } from "@/components/Logo";
import { PasswordInput } from "@/components/PasswordInput";
import { useAuth, roleHome } from "@/lib/auth";

export default function RegisterPage() {
  const { user, loading, register } = useAuth();
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"PATIENT" | "DOCTOR">("PATIENT");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && user) router.replace(roleHome(user.role));
  }, [user, loading, router]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await register({ name, email, password, role, phone: phone || undefined });
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-10">
      <div className="card w-full max-w-md p-8">
        <div className="flex justify-center">
          <Logo />
        </div>
        <h1 className="h1 mt-6 text-center">Create your account</h1>

        <form className="mt-6 space-y-4" onSubmit={submit}>
          <div>
            <label className="label">Full name</label>
            <input className="input mt-1" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div>
            <label className="label">Email</label>
            <input
              className="input mt-1"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="label">Password</label>
            <PasswordInput
              autoComplete="new-password"
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <p className="small mt-1">At least 8 characters.</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">I am a</label>
              <select
                className="input mt-1"
                value={role}
                onChange={(e) => setRole(e.target.value as "PATIENT" | "DOCTOR")}
              >
                <option value="PATIENT">Patient</option>
                <option value="DOCTOR">Doctor</option>
              </select>
            </div>
            <div>
              <label className="label">Phone (optional)</label>
              <input className="input mt-1" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
          </div>

          {error && (
            <p className="small" style={{ color: "var(--danger)" }}>
              {error}
            </p>
          )}

          <button className="btn btn-primary w-full justify-center" disabled={busy}>
            {busy ? "Creating…" : "Create account"}
          </button>
        </form>

        <p className="small mt-6 text-center">
          Already have an account?{" "}
          <Link href="/login" style={{ color: "var(--primary)", fontWeight: 500 }}>
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
