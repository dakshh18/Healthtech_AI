"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { Logo } from "./Logo";
import { ThemeToggle } from "./ThemeToggle";
import { useAuth } from "@/lib/auth";
import { useAppointments } from "@/lib/hooks";
import type { Role } from "@/types";

const LINKS: Record<Role, { href: string; label: string }[]> = {
  PATIENT: [
    { href: "/appointments", label: "Appointments" },
    { href: "/doctors", label: "Doctors" },
    { href: "/prescriptions", label: "Prescriptions" },
    { href: "/me", label: "My records" },
  ],
  DOCTOR: [
    { href: "/", label: "Visits" },
    { href: "/appointments", label: "Schedule" },
    { href: "/patients", label: "Patients" },
    { href: "/prescriptions", label: "Prescriptions" },
    { href: "/doctors/me", label: "My profile" },
  ],
  ADMIN: [
    { href: "/admin", label: "Dashboard" },
    { href: "/", label: "Visits" },
    { href: "/patients", label: "Patients" },
  ],
};

export function Sidebar() {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  const appts = useAppointments();
  const pendingCount = (appts.data?.appointments ?? []).filter((a) => a.status === "PENDING").length;

  if (!user) return null;

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  const badgeFor = (href: string) =>
    user.role === "DOCTOR" && href === "/appointments" ? pendingCount : 0;

  const onLogout = () => {
    logout();
    router.replace("/login");
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <Logo />
      </div>

      <nav className="sidebar-nav">
        {LINKS[user.role].map((l) => {
          const count = badgeFor(l.href);
          return (
            <Link key={l.href} href={l.href} className="sidebar-link" data-active={isActive(l.href)}>
              <span>{l.label}</span>
              {count > 0 && <span className="nav-badge">{count}</span>}
            </Link>
          );
        })}
      </nav>

      <div className="sidebar-foot">
        <div className="mb-3">
          <div className="text-sm" style={{ color: "var(--fg1)", fontWeight: 500 }}>
            {user.name}
          </div>
          <div className="label">{user.role}</div>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <button className="btn btn-ghost btn-sm" onClick={onLogout} title="Log out">
            <LogOut size={15} />
            Logout
          </button>
        </div>
      </div>
    </aside>
  );
}
