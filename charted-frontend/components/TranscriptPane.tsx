import { FileText, ShieldCheck } from "lucide-react";
import { parseTranscript, splitMasks, type Speaker } from "@/lib/transcript";

function SpeakerChip({ speaker }: { speaker: Speaker }) {
  if (speaker === "dr") return <span className="speaker speaker-dr">Dr</span>;
  if (speaker === "pt") return <span className="speaker speaker-pt">Pt</span>;
  return <span className="speaker speaker-pt">·</span>;
}

function MaskedText({ text }: { text: string }) {
  return (
    <>
      {splitMasks(text).map((part, i) =>
        part.mask ? (
          <span key={i} className="mask">
            {part.value}
          </span>
        ) : (
          <span key={i}>{part.value}</span>
        )
      )}
    </>
  );
}

export function TranscriptPane({ text }: { text: string | null }) {
  const turns = text ? parseTranscript(text) : [];

  return (
    <section className="card flex flex-col" style={{ maxHeight: "calc(100vh - 180px)" }}>
      <div className="flex items-center justify-between px-5 py-4">
        <div className="flex items-center gap-2">
          <FileText size={17} className="text-fg2" />
          <h2 className="h3">Transcript</h2>
        </div>
        <span className="badge badge-neutral" style={{ paddingLeft: 10 }}>
          <ShieldCheck size={13} style={{ marginLeft: -2 }} />
          PHI masked
        </span>
      </div>
      <hr className="divider" />

      <div className="overflow-y-auto px-5 py-2">
        {turns.length === 0 && <p className="small py-4">No transcript available.</p>}
        {turns.map((turn, i) => (
          <div key={i} className="flex gap-3 py-3" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
            {turn.speaker && <SpeakerChip speaker={turn.speaker} />}
            <p
              className="body-lg"
              style={{
                lineHeight: "var(--leading-relaxed)",
                color: turn.speaker === "pt" ? "var(--fg2)" : "var(--fg1)",
              }}
            >
              <MaskedText text={turn.text} />
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
