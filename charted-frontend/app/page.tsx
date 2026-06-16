"use client";

import Link from "next/link";
import { Plus, Calendar, Stethoscope, FileText } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { VisitList } from "@/components/VisitList";
import { useAuth } from "@/lib/auth";

export default function HomePage() {
  return (
    <AppShell>
      <Home />
    </AppShell>
  );
}

function Home() {
  const { user } = useAuth();
  if (!user) return null;

  if (user.role === "PATIENT") return <PatientLanding />;

  // Doctors and admins land on the scribe queue.
  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Link href="/new" className="btn btn-primary">
          <Plus size={17} />
          New visit
        </Link>
      </div>
      <VisitList />
    </div>
  );
}

function PatientLanding() {
  const tiles = [
    { href: "/appointments", icon: Calendar, title: "Appointments", desc: "Book a visit and track its status." },
    { href: "/doctors", icon: Stethoscope, title: "Find a doctor", desc: "Browse clinicians by specialty." },
    { href: "/me", icon: FileText, title: "My records", desc: "Your visits, notes, and prescriptions." },
  ];
  return (
    <div>
      <h1 className="h1">Welcome</h1>
      <p className="small mt-1">Manage your care from here.</p>
      <div className="mt-6 grid gap-4 md:grid-cols-3">
        {tiles.map((t) => (
          <Link key={t.href} href={t.href} className="card card-hover p-6">
            <t.icon size={20} className="text-primary" />
            <div className="body-lg mt-3" style={{ fontWeight: 500 }}>
              {t.title}
            </div>
            <p className="small mt-1">{t.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
