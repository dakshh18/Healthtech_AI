"use client";

import { Calendar, FileText, Pill } from "lucide-react";
import { usePatientHistory } from "@/lib/hooks";
import { StatusPill } from "./StatusPill";

const ICONS = { appointment: Calendar, visit: FileText, prescription: Pill } as const;

export function PatientChart({ id }: { id: string }) {
  const { data, isLoading, isError, error } = usePatientHistory(id);

  if (isLoading) return <p className="small">Loading…</p>;
  if (isError)
    return (
      <p className="small" style={{ color: "var(--danger)" }}>
        {(error as Error).message}
      </p>
    );
  if (!data) return null;

  const { patient, counts, timeline } = data;
  const meta = [
    patient.age ? `${patient.age}y` : null,
    patient.gender,
    patient.phone,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div>
      <h1 className="h1">{patient.name}</h1>
      <p className="small mt-1">
        {patient.email}
        {meta ? ` · ${meta}` : ""}
      </p>

      <div className="mt-6 grid grid-cols-3 gap-4">
        <Stat label="Visits" value={counts.visits} />
        <Stat label="Appointments" value={counts.appointments} />
        <Stat label="Prescriptions" value={counts.prescriptions} />
      </div>

      <h2 className="h3 mt-8">Timeline</h2>
      <div className="mt-3 space-y-2">
        {timeline.length === 0 && (
          <div className="card p-6 text-center small">No activity yet</div>
        )}
        {timeline.map((e, i) => {
          const Icon = ICONS[e.type];
          return (
            <div key={i} className="card flex items-center gap-3 p-4">
              <Icon size={16} className="text-fg3" />
              <div className="flex-1">
                <div className="body-lg" style={{ fontWeight: 500 }}>
                  {e.title}
                </div>
                <div className="small capitalize">{e.type}</div>
              </div>
              {e.status && <StatusPill status={e.status} />}
              <div className="small">{new Date(e.at).toLocaleDateString()}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="card p-5">
      <div className="label">{label}</div>
      <div className="h1 mt-1">{value}</div>
    </div>
  );
}
