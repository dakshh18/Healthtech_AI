"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Calendar, Check, X, Play, Stethoscope } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { StatusPill } from "@/components/StatusPill";
import { useAuth } from "@/lib/auth";
import {
  useAppointments,
  useDoctors,
  useBookAppointment,
  useAppointmentAction,
  useStartAppointment,
} from "@/lib/hooks";
import type { Appointment } from "@/types";

export default function AppointmentsPage() {
  return (
    <AppShell>
      <Inner />
    </AppShell>
  );
}

function fmt(dt: string) {
  return new Date(dt).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function Inner() {
  const { user } = useAuth();
  if (!user) return null;
  const isPatient = user.role === "PATIENT";

  return (
    <div>
      <h1 className="h1">{isPatient ? "Appointments" : "Schedule"}</h1>
      <p className="small mt-1">
        {isPatient
          ? "Book a consultation and track its status."
          : "Confirm requests and start visits — starting runs the AI scribe."}
      </p>

      {isPatient && <BookForm />}

      <div className="mt-8">
        <AppointmentList patient={isPatient} />
      </div>
    </div>
  );
}

function BookForm() {
  const doctors = useDoctors();
  const book = useBookAppointment();
  const [doctorId, setDoctorId] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [reason, setReason] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!doctorId || !scheduledAt) return;
    book.mutate(
      { doctorId, scheduledAt: new Date(scheduledAt).toISOString(), reason: reason || undefined },
      {
        onSuccess: () => {
          setReason("");
          setScheduledAt("");
        },
      }
    );
  };

  return (
    <form className="card mt-6 p-6" onSubmit={submit}>
      <h2 className="h3">Book an appointment</h2>
      <div className="mt-4 grid gap-4 md:grid-cols-3">
        <div>
          <label className="label">Doctor</label>
          <select className="input mt-1" value={doctorId} onChange={(e) => setDoctorId(e.target.value)} required>
            <option value="">Select a doctor…</option>
            {(doctors.data?.doctors ?? []).map((d) => (
              <option key={d.user_id} value={d.user_id}>
                {d.name} — {d.specialization}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Date &amp; time</label>
          <input
            className="input mt-1"
            type="datetime-local"
            value={scheduledAt}
            onChange={(e) => setScheduledAt(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="label">Reason (optional)</label>
          <input className="input mt-1" value={reason} onChange={(e) => setReason(e.target.value)} />
        </div>
      </div>
      {(doctors.data?.doctors ?? []).length === 0 && !doctors.isLoading && (
        <p className="small mt-3" style={{ color: "var(--fg3)" }}>
          No doctors have published a profile yet.
        </p>
      )}
      {book.isError && (
        <p className="small mt-3" style={{ color: "var(--danger)" }}>
          {(book.error as Error).message}
        </p>
      )}
      <div className="mt-4 flex justify-end">
        <button className="btn btn-primary" disabled={book.isPending}>
          <Calendar size={17} />
          {book.isPending ? "Booking…" : "Book appointment"}
        </button>
      </div>
    </form>
  );
}

function AppointmentList({ patient }: { patient: boolean }) {
  const { data, isLoading, isError, error } = useAppointments();
  const appts = data?.appointments ?? [];

  if (isLoading) return <p className="small">Loading…</p>;
  if (isError)
    return (
      <p className="small" style={{ color: "var(--danger)" }}>
        {(error as Error).message}
      </p>
    );
  if (appts.length === 0)
    return (
      <div className="card p-8 text-center">
        <p className="body-lg">No appointments yet</p>
      </div>
    );

  return (
    <div className="space-y-3">
      {appts.map((a) => (
        <AppointmentCard key={a.id} appt={a} patient={patient} />
      ))}
    </div>
  );
}

function AppointmentCard({ appt, patient }: { appt: Appointment; patient: boolean }) {
  const router = useRouter();
  const action = useAppointmentAction();
  const start = useStartAppointment();
  const [expanded, setExpanded] = useState(false);
  const [transcript, setTranscript] = useState("");

  const who = patient ? appt.doctor_name : appt.patient_name;
  const canCancel = appt.status === "PENDING" || appt.status === "CONFIRMED";

  const startVisit = () => {
    if (!transcript.trim()) return;
    start.mutate(
      { id: appt.id, transcript: transcript.trim() },
      { onSuccess: (res) => router.push(`/visits/${res.visit.id}`) }
    );
  };

  return (
    <div className="card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Stethoscope size={16} className="text-fg3" />
            <span className="body-lg" style={{ fontWeight: 500 }}>
              {who ?? (patient ? "Doctor" : "Patient")}
            </span>
            <StatusPill status={appt.status} />
          </div>
          <p className="small mt-1">{fmt(appt.scheduled_at)}</p>
          {appt.reason && <p className="small mt-1">Reason: {appt.reason}</p>}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {appt.visit_id && (
            <button className="btn btn-sm" onClick={() => router.push(`/visits/${appt.visit_id}`)}>
              View note
            </button>
          )}

          {/* Doctor actions */}
          {!patient && appt.status === "PENDING" && (
            <>
              <button
                className="btn btn-sm"
                onClick={() => action.mutate({ id: appt.id, action: "confirm" })}
                disabled={action.isPending}
              >
                <Check size={15} /> Confirm
              </button>
              <button
                className="btn btn-sm"
                onClick={() => action.mutate({ id: appt.id, action: "reject" })}
                disabled={action.isPending}
              >
                <X size={15} /> Reject
              </button>
            </>
          )}
          {!patient && appt.status === "CONFIRMED" && (
            <button className="btn btn-primary btn-sm" onClick={() => setExpanded((v) => !v)}>
              <Play size={15} /> Start visit
            </button>
          )}

          {/* Cancel — either party while still open */}
          {canCancel && (
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => action.mutate({ id: appt.id, action: "cancel" })}
              disabled={action.isPending}
            >
              Cancel
            </button>
          )}
        </div>
      </div>

      {!patient && expanded && appt.status === "CONFIRMED" && (
        <div className="mt-4 border-t pt-4" style={{ borderColor: "var(--border)" }}>
          <label className="label">Consultation transcript</label>
          <textarea
            className="field mt-1"
            rows={5}
            placeholder="Paste or type the consultation transcript. The scribe drafts a SOAP note from it."
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
          />
          {start.isError && (
            <p className="small mt-2" style={{ color: "var(--danger)" }}>
              {(start.error as Error).message}
            </p>
          )}
          <div className="mt-3 flex justify-end">
            <button
              className="btn btn-primary"
              onClick={startVisit}
              disabled={start.isPending || !transcript.trim()}
            >
              {start.isPending ? "Running scribe…" : "Generate note"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
