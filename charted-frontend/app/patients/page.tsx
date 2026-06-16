"use client";

import Link from "next/link";
import { User as UserIcon } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { usePatients } from "@/lib/hooks";

export default function PatientsPage() {
  return (
    <AppShell roles={["DOCTOR", "ADMIN"]}>
      <Directory />
    </AppShell>
  );
}

function Directory() {
  const { data, isLoading, isError, error } = usePatients();
  const patients = data?.patients ?? [];

  return (
    <div>
      <h1 className="h1">Patients</h1>
      <p className="small mt-1">Open a patient to see their full chart.</p>

      <div className="mt-6">
        {isLoading && <p className="small">Loading…</p>}
        {isError && (
          <p className="small" style={{ color: "var(--danger)" }}>
            {(error as Error).message}
          </p>
        )}
        {!isLoading && !isError && patients.length === 0 && (
          <div className="card p-8 text-center">
            <p className="body-lg">No patients yet</p>
          </div>
        )}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {patients.map((p) => (
            <Link key={p.id} href={`/patients/${p.id}`} className="card card-hover p-5">
              <div className="flex items-center gap-2">
                <UserIcon size={16} className="text-fg3" />
                <span className="body-lg" style={{ fontWeight: 500 }}>
                  {p.name}
                </span>
              </div>
              <p className="small mt-2">{p.email}</p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
