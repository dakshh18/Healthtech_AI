"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, Square } from "lucide-react";
import { formatClock } from "@/lib/format";

// Records mic audio with the browser MediaRecorder API and hands the finished
// blob to the parent (which posts it on "Create draft").
export function AudioRecorder({
  onRecorded,
}: {
  onRecorded: (blob: Blob | null) => void;
}) {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [hasClip, setHasClip] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      recorderRef.current?.stream.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const start = async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      chunksRef.current = [];

      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        setHasClip(true);
        onRecorded(blob);
        stream.getTracks().forEach((t) => t.stop());
      };

      rec.start();
      recorderRef.current = rec;
      setSeconds(0);
      setHasClip(false);
      onRecorded(null);
      setRecording(true);
      timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    } catch {
      setError("Microphone access was denied. Allow it, or use upload / paste.");
    }
  };

  const stop = () => {
    recorderRef.current?.stop();
    setRecording(false);
    if (timerRef.current) clearInterval(timerRef.current);
  };

  return (
    <div className="flex flex-col items-center py-6">
      <button
        type="button"
        onClick={recording ? stop : start}
        aria-label={recording ? "Stop recording" : "Start recording"}
        className="flex items-center justify-center"
        style={{
          width: 88,
          height: 88,
          borderRadius: "50%",
          background: recording ? "var(--danger)" : "var(--primary)",
          color: "#fff",
          border: "none",
          cursor: "pointer",
          transition: "background-color .14s ease",
        }}
      >
        {recording ? <Square size={30} fill="#fff" /> : <Mic size={32} />}
      </button>

      <div className="mono mt-4" style={{ fontSize: "var(--text-h1)" }}>
        {formatClock(seconds)}
      </div>

      <p className="small mt-2 flex items-center gap-2">
        {recording ? (
          <>
            <span className="rec-dot" /> Recording — tap to stop
          </>
        ) : hasClip ? (
          "Recording ready · tap the mic to redo"
        ) : (
          "Tap the microphone to start recording"
        )}
      </p>

      {error && (
        <p className="small mt-3" style={{ color: "var(--danger)" }}>
          {error}
        </p>
      )}
    </div>
  );
}
