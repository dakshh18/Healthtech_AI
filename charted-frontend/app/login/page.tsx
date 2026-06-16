"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Logo } from "@/components/Logo";
import { PasswordInput } from "@/components/PasswordInput";
import { useAuth, roleHome } from "@/lib/auth";

export default function LoginPage() {
  const { user, loading, login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
      await login(email, password);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="card w-full max-w-md p-8">
        <div className="flex justify-center">
          <Logo />
        </div>
        <h1 className="h1 mt-6 text-center">Sign in</h1>
        <p className="small mt-1 text-center">Welcome back to Charted.</p>

        <form className="mt-6 space-y-4" onSubmit={submit}>
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
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          {error && (
            <p className="small" style={{ color: "var(--danger)" }}>
              {error}
            </p>
          )}

          <button className="btn btn-primary w-full justify-center" disabled={busy}>
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <p className="small mt-6 text-center">
          No account?{" "}
          <Link href="/register" style={{ color: "var(--primary)", fontWeight: 500 }}>
            Create one
          </Link>
        </p>
      </div>
    </main>
  );
}
