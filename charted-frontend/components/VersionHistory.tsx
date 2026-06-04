"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, GitCompare } from "lucide-react";
import type { NoteVersion, SoapNote } from "@/types";
import { useVersions } from "@/lib/hooks";
import { formatDateTime } from "@/lib/format";
import { wordDiff, hasChange, type Seg } from "@/lib/diff";
import { Header } from "./Header";
import { ThemeToggle } from "./ThemeToggle";

const FIELDS: { key: keyof SoapNote; label: string }[] = [
  { key: "chiefComplaint", label: "Chief complaint" },
  { key: "subjective", label: "Subjective" },
  { key: "objective", label: "Objective" },
  { key: "assessment", label: "Assessment" },
  { key: "plan", label: "Plan" },
];

function fieldText(soap: SoapNote, key: keyof SoapNote): string {
  if (key === "medications") return soap.medications.join(", ");
  if (key === "allergies") return soap.allergies.join(", ");
  return String(soap[key] ?? "");
}

function DiffText({ segs }: { segs: Seg[] }) {
  return (
    <p className="body" style={{ lineHeight: "var(--leading-relaxed)" }}>
      {segs.map((s, i) =>
        s.type === "same" ? (
          <span key={i}>{s.text}</span>
        ) : s.type === "add" ? (
          <span key={i} className="diff-add">
            {s.text}
          </span>
        ) : (
          <span key={i} className="diff-del">
            {s.text}
          </span>
        )
      )}
    </p>
  );
}

export function VersionHistory({ visitId }: { visitId: string }) {
  const { data, isLoading, isError, error } = useVersions(visitId);

  // newest-first for display
  const versions = useMemo<NoteVersion[]>(
    () => (data ? [...data.versions].sort((a, b) => b.version - a.version) : []),
    [data]
  );

  const [newerNo, setNewerNo] = useState<number | null>(null);
  const [olderNo, setOlderNo] = useState<number | null>(null);

  const newer = versions.find((v) => v.version === newerNo) ?? versions[0];
  const older =
    versions.find((v) => v.version === olderNo) ?? versions[1] ?? versions[0];

  const allFields = [
    ...FIELDS,
    { key: "medications" as const, label: "Medications" },
    { key: "allergies" as const, label: "Allergies" },
  ];

  return (
    <>
      <Header>
        <ThemeToggle />
      </Header>

      <div
        className="flex items-center gap-3 px-6 py-3"
        style={{ borderBottom: "1px solid var(--border)", background: "var(--surface)" }}
      >
        <Link href={`/visits/${visitId}`} className="btn btn-ghost btn-sm">
          <ArrowLeft size={15} />
          Back to review
        </Link>
        <h1 className="h3">Version history</h1>
      </div>

      <main className="mx-auto max-w-5xl px-6 py-6">
        {isLoading && <p className="small">Loading versions...</p>}
        {isError && (
          <div className="card p-6 small" style={{ color: "var(--danger)" }}>
            {(error as Error).message}
          </div>
        )}

        {!isLoading && !isError && (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[260px_1fr]">
            {/* Version list */}
            <div className="space-y-2">
              {versions.map((v) => (
                <div key={v.version} className="card p-4">
                  <div className="flex items-center justify-between">
                    <span className={`vtag ${v.source === "ai" ? "vtag-ai" : "vtag-clin"}`}>
                      {v.source === "ai" ? "AI draft" : "Clinician edit"}
                    </span>
                    <span className="mono small">v{v.version}</span>
                  </div>
                  <p className="small mt-2">{formatDateTime(v.createdAt)}</p>
                  <p className="small text-fg3">{v.author}</p>
                </div>
              ))}
            </div>

            {/* Diff */}
            <div>
              {versions.length < 2 ? (
                <div className="card p-6">
                  <p className="body">Only one version exists — nothing to compare yet.</p>
                  <p className="small mt-1">
                    Clinician edits will appear here as new versions you can diff.
                  </p>
                </div>
              ) : (
                <div className="card p-5">
                  <div className="mb-4 flex flex-wrap items-center gap-3">
                    <GitCompare size={16} className="text-fg2" />
                    <label className="small flex items-center gap-2">
                      Compare
                      <select
                        className="input"
                        style={{ width: "auto", padding: "4px 8px" }}
                        value={older?.version}
                        onChange={(e) => setOlderNo(Number(e.target.value))}
                      >
                        {versions.map((v) => (
                          <option key={v.version} value={v.version}>
                            v{v.version} · {v.source === "ai" ? "AI draft" : "Clinician edit"}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="small flex items-center gap-2">
                      with
                      <select
                        className="input"
                        style={{ width: "auto", padding: "4px 8px" }}
                        value={newer?.version}
                        onChange={(e) => setNewerNo(Number(e.target.value))}
                      >
                        {versions.map((v) => (
                          <option key={v.version} value={v.version}>
                            v{v.version} · {v.source === "ai" ? "AI draft" : "Clinician edit"}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <div className="space-y-4">
                    {older &&
                      newer &&
                      allFields.map((f) => {
                        const segs = wordDiff(
                          fieldText(older.soap, f.key),
                          fieldText(newer.soap, f.key)
                        );
                        const changed = hasChange(segs);
                        return (
                          <div
                            key={f.key}
                            className="pb-4"
                            style={{ borderBottom: "1px solid var(--border-subtle)" }}
                          >
                            <div className="mb-1 flex items-center gap-2">
                              <span className="label">{f.label}</span>
                              {changed && (
                                <span className="small" style={{ color: "var(--amber)" }}>
                                  changed
                                </span>
                              )}
                            </div>
                            <DiffText segs={segs} />
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </>
  );
}
