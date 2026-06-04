"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Upload, FileText } from "lucide-react";
import { useCreateVisit } from "@/lib/hooks";
import { AudioRecorder } from "./AudioRecorder";

type Tab = "record" | "upload" | "paste";

const TABS: { id: Tab; label: string }[] = [
  { id: "record", label: "Record" },
  { id: "upload", label: "Upload audio" },
  { id: "paste", label: "Paste transcript" },
];

export function NewVisitForm() {
  const router = useRouter();
  const create = useCreateVisit();

  const [tab, setTab] = useState<Tab>("record");
  const [blob, setBlob] = useState<Blob | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [transcript, setTranscript] = useState("");

  const canCreate =
    tab === "record" ? !!blob : tab === "upload" ? !!file : transcript.trim().length > 0;

  const onCreate = () => {
    let input: { transcript: string } | FormData;
    if (tab === "paste") {
      input = { transcript: transcript.trim() };
    } else {
      const fd = new FormData();
      if (tab === "record" && blob) fd.append("audio", blob, "visit.webm");
      if (tab === "upload" && file) fd.append("audio", file, file.name);
      input = fd;
    }
    create.mutate(input, {
      onSuccess: (res) => router.push(`/visits/${res.visit.id}`),
    });
  };

  if (create.isPending) return <Processing audio={tab !== "paste"} />;

  return (
    <div className="card mx-auto max-w-2xl p-8">
      <h1 className="h1">New visit</h1>
      <p className="small mt-2">
        Capture or import a conversation. Charted drafts the note — you review and approve it.
      </p>

      <div
        className="mt-6 flex gap-1 rounded-md p-1"
        style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}
      >
        {TABS.map((t) => {
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className="flex-1 rounded-md py-2 text-center"
              style={{
                font: "var(--weight-medium) var(--text-body)/1 var(--font-sans)",
                background: active ? "var(--surface)" : "transparent",
                color: active ? "var(--fg1)" : "var(--fg2)",
                border: active ? "1px solid var(--border)" : "1px solid transparent",
              }}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      <div className="mt-6 min-h-[180px]">
        {tab === "record" && <AudioRecorder onRecorded={setBlob} />}
        {tab === "upload" && <UploadPane file={file} onFile={setFile} />}
        {tab === "paste" && (
          <textarea
            className="field"
            rows={8}
            placeholder="Paste the consultation transcript here..."
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
          />
        )}
      </div>

      {create.isError && (
        <p className="small mt-4" style={{ color: "var(--danger)" }}>
          {(create.error as Error).message}
        </p>
      )}

      <div className="mt-6 flex items-center justify-end gap-3">
        <button className="btn btn-ghost" onClick={() => router.push("/")}>
          Cancel
        </button>
        <button className="btn btn-primary" disabled={!canCreate} onClick={onCreate}>
          <Sparkles size={17} />
          Create draft
        </button>
      </div>
    </div>
  );
}

function UploadPane({ file, onFile }: { file: File | null; onFile: (f: File) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [hover, setHover] = useState(false);

  return (
    <div
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => {
        e.preventDefault();
        setHover(true);
      }}
      onDragLeave={() => setHover(false)}
      onDrop={(e) => {
        e.preventDefault();
        setHover(false);
        const f = e.dataTransfer.files?.[0];
        if (f) onFile(f);
      }}
      className="flex flex-col items-center justify-center rounded-lg py-12 text-center"
      style={{
        border: "1.5px dashed var(--border-strong)",
        background: hover ? "var(--surface-2)" : "transparent",
        cursor: "pointer",
      }}
    >
      <Upload size={26} className="text-fg3" />
      {file ? (
        <>
          <p className="body-lg mt-3" style={{ fontWeight: 500 }}>
            {file.name}
          </p>
          <p className="small mt-1">Click to choose a different file</p>
        </>
      ) : (
        <>
          <p className="body-lg mt-3" style={{ fontWeight: 500 }}>
            Drop an audio file or click to browse
          </p>
          <p className="small mt-1">WAV, MP3 or M4A · up to 25MB</p>
        </>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="audio/*,.wav,.mp3,.m4a,.webm"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
        }}
      />
    </div>
  );
}

function Processing({ audio }: { audio: boolean }) {
  return (
    <div className="card mx-auto max-w-2xl p-12 text-center">
      <div className="mx-auto flex items-center justify-center" style={{ width: 56, height: 56 }}>
        <Sparkles size={40} className="text-primary shimmer" />
      </div>
      <p className="h2 mt-5">{audio ? "Transcribing and drafting the note" : "Drafting the note"}</p>
      <p className="small mt-2">
        {audio
          ? "Transcribing the audio, redacting PHI, and structuring the SOAP note. This takes a few seconds."
          : "Redacting PHI and structuring the SOAP note. This takes a few seconds."}
      </p>
      <div className="mt-8 space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-3 rounded shimmer"
            style={{ background: "var(--surface-3)", width: `${90 - i * 12}%`, margin: "0 auto" }}
          />
        ))}
      </div>
    </div>
  );
}
