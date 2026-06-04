import Link from "next/link";
import { Clock } from "lucide-react";
import type { Visit } from "@/types";
import { formatDate, formatDuration } from "@/lib/format";
import { StatusBadge } from "./StatusBadge";

export function VisitCard({ visit }: { visit: Visit }) {
  const duration = formatDuration(visit.audio_seconds);
  const name = visit.demographics?.name;
  const age = visit.demographics?.age;

  return (
    <Link href={`/visits/${visit.id}`} className="card card-hover block p-5">
      <div className="flex items-center justify-between gap-3">
        {name ? (
          <div className="min-w-0">
            <span className="h3 block truncate">
              {name}
              {age != null && <span className="text-fg3"> · {age}</span>}
            </span>
            <span className="mono small text-fg3">#{visit.patient_ref}</span>
          </div>
        ) : (
          <span className="mono" style={{ fontSize: "var(--text-body-lg)" }}>
            #{visit.patient_ref}
          </span>
        )}
        <StatusBadge status={visit.status} />
      </div>
      <div className="mt-3 flex items-center gap-2 text-fg2 small">
        <Clock size={15} className="text-fg3" />
        <span>{formatDate(visit.created_at)}</span>
        {duration && (
          <>
            <span className="text-fg3">·</span>
            <span>{duration}</span>
          </>
        )}
      </div>
    </Link>
  );
}
