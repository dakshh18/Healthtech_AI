"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, CircleCheck, History } from "lucide-react";
import type { SoapNote } from "@/types";
import { useApprove, useSaveNote, useVisit } from "@/lib/hooks";
import { formatDate, formatDuration } from "@/lib/format";
import { Header } from "./Header";
import { ThemeToggle } from "./ThemeToggle";
import { StatusBadge } from "./StatusBadge";
import { TranscriptPane } from "./TranscriptPane";
import { SoapEditor } from "./SoapEditor";
import { IcdChips } from "./IcdChips";

export type ReviewState =
  | "loading"
  | "reviewing"
  | "dirty"
  | "saving"
  | "approvable"
  | "approved";

export function ReviewWorkspace({ visitId }: { visitId: string }) {
  const { data, isLoading, isError, error } = useVisit(visitId);
  const save = useSaveNote(visitId);
  const approve = useApprove(visitId);

  const [soap, setSoap] = useState<SoapNote | null>(null);
  const [dirty, setDirty] = useState(false);
  const [reviewed, setReviewed] = useState(false);

  const isApproved = data?.visit.status === "approved";
  const source = data?.note?.source ?? "ai";

  // Load the server note into local state; don't clobber unsaved edits.
  useEffect(() => {
    if (data?.note && !dirty) setSoap(data.note.soap);
  }, [data, dirty]);

  const state: ReviewState =
    isLoading || !soap
      ? "loading"
      : isApproved
        ? "approved"
        : save.isPending
          ? "saving"
          : dirty
            ? "dirty"
            : reviewed
              ? "approvable"
              : "reviewing";

  const edit = (next: SoapNote) => {
    setSoap(next);
    setDirty(true);
  };

  const onSave = () => {
    if (soap) save.mutate(soap, { onSuccess: () => setDirty(false) });
  };

  const onApprove = () => approve.mutate();

  if (isError) {
    return (
      <>
        <Header>
          <ThemeToggle />
        </Header>
        <main className="mx-auto max-w-6xl px-6 py-8">
          <div className="card p-6 small" style={{ color: "var(--danger)" }}>
            Couldn&apos;t load this visit: {(error as Error).message}
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <Header>
        <Link href={`/visits/${visitId}/history`} className="btn btn-ghost btn-sm">
          <History size={15} />
          Version history
        </Link>
        <ThemeToggle />
        {!isApproved && (
          <>
            <label className="flex cursor-pointer items-center gap-2 select-none small">
              <input
                type="checkbox"
                checked={reviewed}
                onChange={(e) => setReviewed(e.target.checked)}
              />
              I&apos;ve reviewed this note
            </label>
            {state === "dirty" || state === "saving" ? (
              <button className="btn" disabled={save.isPending} onClick={onSave}>
                {save.isPending ? "Saving..." : "Save changes"}
              </button>
            ) : null}
            <button
              className="btn btn-primary"
              disabled={state !== "approvable" || approve.isPending}
              onClick={onApprove}
            >
              <Check size={17} />
              {approve.isPending ? "Finalizing..." : "Approve & finalize"}
            </button>
          </>
        )}
        {isApproved && <StatusBadge status="approved" />}
      </Header>

      {/* Sub-header: identity + status */}
      <div
        className="flex flex-wrap items-center gap-3 px-6 py-3"
        style={{ borderBottom: "1px solid var(--border)", background: "var(--surface)" }}
      >
        <Link href="/" className="btn btn-ghost btn-sm">
          <ArrowLeft size={15} />
          Visits
        </Link>
        {data && (
          <>
            {data.visit.demographics?.name && (
              <span className="h3">
                {data.visit.demographics.name}
                {data.visit.demographics.age != null && (
                  <span className="text-fg3"> · {data.visit.demographics.age}</span>
                )}
                {data.visit.demographics.sex && (
                  <span className="text-fg3"> · {data.visit.demographics.sex}</span>
                )}
              </span>
            )}
            <span className="mono" style={{ fontSize: "var(--text-body-lg)" }}>
              #{data.visit.patient_ref}
            </span>
            <span className="small">
              {formatDate(data.visit.created_at)}
              {formatDuration(data.visit.audio_seconds) && (
                <>
                  <span className="text-fg3"> · </span>
                  {formatDuration(data.visit.audio_seconds)}
                </>
              )}
            </span>
            <StatusBadge status={data.visit.status} />
          </>
        )}
      </div>

      <main className="mx-auto max-w-7xl px-6 py-6">
        {state === "loading" || !soap || !data ? (
          <LoadingPanes />
        ) : (
          <>
            {isApproved && (
              <div
                className="card mb-4 flex items-center gap-3 p-4"
                style={{ background: "var(--green-subtle)", borderColor: "var(--green-border)" }}
              >
                <CircleCheck size={18} style={{ color: "var(--green)" }} />
                <p className="body" style={{ color: "var(--green-strong)" }}>
                  This note is approved and finalized. It is now read-only.
                </p>
              </div>
            )}

            {(save.isError || approve.isError) && (
              <p className="small mb-4" style={{ color: "var(--danger)" }}>
                {((save.error || approve.error) as Error).message}
              </p>
            )}

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <TranscriptPane text={data.redactedTranscript} />
              <div className="space-y-4">
                <SoapEditor
                  soap={soap}
                  source={source}
                  readOnly={isApproved}
                  onChange={edit}
                />
                <IcdChips
                  codes={soap.icdCodes}
                  readOnly={isApproved}
                  onChange={(codes) => edit({ ...soap, icdCodes: codes })}
                />
              </div>
            </div>
          </>
        )}
      </main>
    </>
  );
}

function LoadingPanes() {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {[0, 1].map((i) => (
        <div key={i} className="card p-5 shimmer" style={{ height: 420 }}>
          <div className="h-5 w-32 rounded" style={{ background: "var(--surface-3)" }} />
          <div className="mt-6 space-y-3">
            {Array.from({ length: 6 }).map((_, j) => (
              <div key={j} className="h-4 rounded" style={{ background: "var(--surface-3)" }} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
