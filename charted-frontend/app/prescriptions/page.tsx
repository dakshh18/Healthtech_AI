"use client";

import { useState } from "react";
import { Pill } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/lib/auth";
import { usePrescriptions, useIssuePrescription, useVisits } from "@/lib/hooks";
import type { Prescription } from "@/types";

export default function PrescriptionsPage() {
  return (
    <AppShell>
      <Inner />
    </AppShell>
  );
}

function Inner() {
  const { user } = useAuth();
  if (!user) return null;
  const isDoctor = user.role === "DOCTOR";

  return (
    <div>
      <h1 className="h1">Prescriptions</h1>
      <p className="small mt-1">
        {isDoctor
          ? "Issue prescriptions from approved visits — medications auto-fill from the note."
          : "Your issued prescriptions."}
      </p>

      {isDoctor && <IssueForm />}

      <div className="mt-8">
        <List doctorView={isDoctor || user.role === "ADMIN"} />
      </div>
    </div>
  );
}

function IssueForm() {
  const visits = useVisits();
  const issue = useIssuePrescription();
  const [visitId, setVisitId] = useState("");
  const [notes, setNotes] = useState("");

  const approved = (visits.data?.visits ?? []).filter((v) => v.status === "approved");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!visitId || issue.isPending) return;
    issue.mutate(
      { visitId, notes: notes || undefined },
      {
        onSuccess: () => {
          setNotes("");
          setVisitId("");
        },
      }
    );
  };

  return (
    <form className="card mt-6 p-6" onSubmit={submit}>
      <h2 className="h3">Issue a prescription</h2>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div>
          <label className="label">Approved visit</label>
          <select className="input mt-1" value={visitId} onChange={(e) => setVisitId(e.target.value)} required>
            <option value="">Select an approved visit…</option>
            {approved.map((v) => (
              <option key={v.id} value={v.id}>
                {v.patient_ref} · {new Date(v.created_at).toLocaleDateString()}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Notes (optional)</label>
          <input className="input mt-1" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
      </div>
      {approved.length === 0 && !visits.isLoading && (
        <p className="small mt-3" style={{ color: "var(--fg3)" }}>
          No approved visits yet — approve a note first.
        </p>
      )}
      {issue.isError && (
        <p className="small mt-3" style={{ color: "var(--danger)" }}>
          {(issue.error as Error).message}
        </p>
      )}
      <div className="mt-4 flex justify-end">
        <button className="btn btn-primary" disabled={issue.isPending || !visitId}>
          <Pill size={17} />
          {issue.isPending ? "Issuing…" : "Issue from note"}
        </button>
      </div>
    </form>
  );
}

function List({ doctorView }: { doctorView: boolean }) {
  const { data, isLoading, isError, error } = usePrescriptions();
  const list = data?.prescriptions ?? [];

  if (isLoading) return <p className="small">Loading…</p>;
  if (isError)
    return (
      <p className="small" style={{ color: "var(--danger)" }}>
        {(error as Error).message}
      </p>
    );
  if (list.length === 0)
    return (
      <div className="card p-8 text-center">
        <p className="body-lg">No prescriptions yet</p>
      </div>
    );

  return (
    <div className="space-y-3">
      {list.map((rx) => (
        <Card key={rx.id} rx={rx} doctorView={doctorView} />
      ))}
    </div>
  );
}

function Card({ rx, doctorView }: { rx: Prescription; doctorView: boolean }) {
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Pill size={16} className="text-fg3" />
          <span className="body-lg" style={{ fontWeight: 500 }}>
            {doctorView ? rx.patient_name ?? "Patient" : rx.doctor_name ?? "Doctor"}
          </span>
        </div>
        <span className="small">{new Date(rx.created_at).toLocaleDateString()}</span>
      </div>
      <ul className="mt-3 space-y-1">
        {rx.items.map((it, i) => (
          <li key={i} className="small">
            <span className="mono">{it.name}</span>
            {it.dosage ? ` — ${it.dosage}` : ""}
            {it.frequency ? `, ${it.frequency}` : ""}
            {it.duration ? `, ${it.duration}` : ""}
          </li>
        ))}
      </ul>
      {rx.notes && <p className="small mt-2 text-fg2">Note: {rx.notes}</p>}
    </div>
  );
}
