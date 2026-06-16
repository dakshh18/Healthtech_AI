"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { Sidebar } from "./Sidebar";
import type { Role } from "@/types";

export function AppShell({
  children,
  roles,
}: {
  children: React.ReactNode;
  roles?: Role[];
}) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) router.replace("/login");
    else if (roles && !roles.includes(user.role)) router.replace("/");
  }, [user, loading, roles, router]);

  const allowed = !!user && (!roles || roles.includes(user.role));

  if (loading || !allowed) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="small">Loading…</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1" style={{ minWidth: 0 }}>
        <div className="mx-auto max-w-6xl px-8 py-8">{children}</div>
      </main>
    </div>
  );
}
