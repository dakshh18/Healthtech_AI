"use client";

import { useState } from "react";
import { Check, X, Sparkles } from "lucide-react";
import type { IcdCode } from "@/types";

export function IcdChips({
  codes,
  readOnly,
  onChange,
}: {
  codes: IcdCode[];
  readOnly: boolean;
  onChange: (codes: IcdCode[]) => void;
}) {
  const [accepted, setAccepted] = useState<Set<string>>(new Set());

  const accept = (code: string) =>
    setAccepted((prev) => new Set(prev).add(code));
  const reject = (code: string) => onChange(codes.filter((c) => c.code !== code));

  return (
    <section className="card">
      <div className="flex items-center gap-2 px-5 py-4">
        <Sparkles size={16} className="text-fg2" />
        <h2 className="h3">Suggested ICD-10 codes</h2>
      </div>
      <hr className="divider" />

      <div className="space-y-2 px-5 py-4">
        {codes.length === 0 && <p className="small">No codes suggested for this visit.</p>}

        {codes.map((c) => {
          const pct = Math.round(c.confidence * 100);
          const low = c.confidence < 0.7;
          return (
            <div key={c.code} className="icd" title={c.rationale}>
              <span className="icd-code">{c.code}</span>
              <span className="icd-desc">{c.description}</span>
              <span className="icd-conf" style={low ? { color: "var(--warn)" } : undefined}>
                {pct}%
              </span>
              {!readOnly && (
                <div className="flex items-center gap-1.5">
                  <button
                    className={`iconbtn iconbtn-accept ${accepted.has(c.code) ? "is-on-accept" : ""}`}
                    aria-label={`Accept ${c.code}`}
                    onClick={() => accept(c.code)}
                  >
                    <Check />
                  </button>
                  <button
                    className="iconbtn iconbtn-reject"
                    aria-label={`Reject ${c.code}`}
                    onClick={() => reject(c.code)}
                  >
                    <X />
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
