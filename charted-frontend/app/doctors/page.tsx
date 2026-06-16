"use client";

import { Stethoscope } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { useDoctors } from "@/lib/hooks";

export default function DoctorsPage() {
  return (
    <AppShell>
      <Directory />
    </AppShell>
  );
}

function Directory() {
  const { data, isLoading, isError, error } = useDoctors();
  const doctors = data?.doctors ?? [];

  return (
    <div>
      <h1 className="h1">Doctors</h1>
      <p className="small mt-1">Browse clinicians and their specialties.</p>

      <div className="mt-6">
        {isLoading && <p className="small">Loading…</p>}
        {isError && (
          <p className="small" style={{ color: "var(--danger)" }}>
            {(error as Error).message}
          </p>
        )}
        {!isLoading && !isError && doctors.length === 0 && (
          <div className="card p-8 text-center">
            <p className="body-lg">No doctor profiles yet</p>
          </div>
        )}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {doctors.map((d) => (
            <div key={d.user_id} className="card p-5">
              <div className="flex items-center gap-2">
                <span className="soap-tag" aria-hidden>
                  <Stethoscope size={15} />
                </span>
                <div>
                  <div className="body-lg" style={{ fontWeight: 500 }}>
                    {d.name}
                  </div>
                  <div className="small">{d.specialization}</div>
                </div>
              </div>
              <p className="small mt-3">
                {d.experience_years} yrs experience
                {d.qualification ? ` · ${d.qualification}` : ""}
              </p>
              {d.bio && <p className="small mt-2 text-fg2">{d.bio}</p>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
