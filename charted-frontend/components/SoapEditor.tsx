"use client";

import { useLayoutEffect, useRef } from "react";
import { Pencil } from "lucide-react";
import type { Flag, SoapNote } from "@/types";
import { ConfidenceFlag } from "./ConfidenceFlag";

const SECTIONS: { key: keyof SoapNote; tag: string; title: string; flagKey: Flag["section"] }[] = [
  { key: "subjective", tag: "S", title: "Subjective", flagKey: "subjective" },
  { key: "objective", tag: "O", title: "Objective", flagKey: "objective" },
  { key: "assessment", tag: "A", title: "Assessment", flagKey: "assessment" },
  { key: "plan", tag: "P", title: "Plan", flagKey: "plan" },
];

export function SoapEditor({
  soap,
  source,
  readOnly,
  onChange,
}: {
  soap: SoapNote;
  source: "ai" | "clinician";
  readOnly: boolean;
  onChange: (next: SoapNote) => void;
}) {
  const set = <K extends keyof SoapNote>(key: K, value: SoapNote[K]) =>
    onChange({ ...soap, [key]: value });

  return (
    <section className="card">
      <div className="flex items-center justify-between px-5 py-4">
        <div className="flex items-center gap-2">
          <Pencil size={16} className="text-fg2" />
          <h2 className="h3">SOAP note{!readOnly && " · editable"}</h2>
        </div>
        <span className={`vtag ${source === "ai" ? "vtag-ai" : "vtag-clin"}`}>
          {source === "ai" ? "AI draft" : "Clinician edit"}
        </span>
      </div>
      <hr className="divider" />

      <div className="px-5 py-2">
        {SECTIONS.map((s, i) => {
          const flag = soap.flags.find((f) => f.section === s.flagKey);
          return (
            <div
              key={s.key}
              className="py-4"
              style={i < SECTIONS.length - 1 ? { borderBottom: "1px solid var(--border-subtle)" } : undefined}
            >
              <div className="mb-2 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="soap-tag">{s.tag}</span>
                  <h3 className="h3">{s.title}</h3>
                </div>
                {flag && <ConfidenceFlag reason={flag.reason} />}
              </div>
              <Field
                value={String(soap[s.key] ?? "")}
                readOnly={readOnly}
                onChange={(v) => set(s.key, v as SoapNote[typeof s.key])}
              />
            </div>
          );
        })}

        <hr className="divider" style={{ margin: "0 -20px" }} />
        <div className="py-4">
          <ListField
            label="Medications"
            values={soap.medications}
            readOnly={readOnly}
            onChange={(v) => set("medications", v)}
          />
          <ListField
            label="Allergies"
            values={soap.allergies}
            readOnly={readOnly}
            onChange={(v) => set("allergies", v)}
            className="mt-3"
          />
          <Vitals soap={soap} readOnly={readOnly} onChange={(v) => set("vitals", v)} />
        </div>
      </div>
    </section>
  );
}

function Field({
  value,
  readOnly,
  onChange,
}: {
  value: string;
  readOnly: boolean;
  onChange: (v: string) => void;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = `${el.scrollHeight}px`;
    }
  }, [value]);

  if (readOnly) {
    return (
      <p className="body-lg" style={{ lineHeight: "var(--leading-relaxed)" }}>
        {value || <span className="text-fg3">—</span>}
      </p>
    );
  }

  return (
    <textarea
      ref={ref}
      className="editable body-lg w-full resize-none"
      style={{ lineHeight: "var(--leading-relaxed)", display: "block", background: "transparent" }}
      value={value}
      rows={1}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

function ListField({
  label,
  values,
  readOnly,
  onChange,
  className,
}: {
  label: string;
  values: string[];
  readOnly: boolean;
  onChange: (v: string[]) => void;
  className?: string;
}) {
  return (
    <div className={className}>
      <span className="label">{label}</span>
      {readOnly ? (
        <p className="body mt-1">
          {values.length ? values.join(", ") : <span className="text-fg3">None recorded</span>}
        </p>
      ) : (
        <input
          className="input mt-1"
          value={values.join(", ")}
          placeholder="None recorded"
          onChange={(e) =>
            onChange(
              e.target.value
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean)
            )
          }
        />
      )}
    </div>
  );
}

function Vitals({
  soap,
  readOnly,
  onChange,
}: {
  soap: SoapNote;
  readOnly: boolean;
  onChange: (v: SoapNote["vitals"]) => void;
}) {
  const { tempC, hr, bp } = soap.vitals;
  const num = (s: string): number | null => (s.trim() === "" ? null : Number(s));

  return (
    <div className="mt-3">
      <span className="label">Vitals</span>
      {readOnly ? (
        <p className="body mt-1">
          {tempC == null && hr == null && !bp ? (
            <span className="text-fg3">None recorded</span>
          ) : (
            [tempC != null && `Temp ${tempC}°C`, hr != null && `HR ${hr}`, bp && `BP ${bp}`]
              .filter(Boolean)
              .join(" · ")
          )}
        </p>
      ) : (
        <div className="mt-1 grid grid-cols-3 gap-3">
          <LabeledInput
            label="Temp °C"
            value={tempC ?? ""}
            type="number"
            onChange={(v) => onChange({ ...soap.vitals, tempC: num(v) })}
          />
          <LabeledInput
            label="HR"
            value={hr ?? ""}
            type="number"
            onChange={(v) => onChange({ ...soap.vitals, hr: num(v) })}
          />
          <LabeledInput
            label="BP"
            value={bp ?? ""}
            type="text"
            onChange={(v) => onChange({ ...soap.vitals, bp: v.trim() === "" ? null : v })}
          />
        </div>
      )}
    </div>
  );
}

function LabeledInput({
  label,
  value,
  type,
  onChange,
}: {
  label: string;
  value: string | number;
  type: "number" | "text";
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="small text-fg3">{label}</span>
      <input
        className="input mt-1"
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}
