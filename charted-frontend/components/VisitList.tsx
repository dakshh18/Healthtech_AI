"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { useVisits } from "@/lib/hooks";
import { VisitCard } from "./VisitCard";

export function VisitList() {
  const { data, isLoading, isError, error } = useVisits();
  const [query, setQuery] = useState("");

  const visits = data?.visits ?? [];
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return visits;
    return visits.filter((v) => {
      const haystack = [
        v.patient_ref,
        v.demographics?.name ?? "",
        v.demographics?.phone ?? "",
        v.demographics?.dob ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [visits, query]);

  const draftCount = visits.filter((v) => v.status === "draft").length;

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="h1">Visits</h1>
          {!isLoading && !isError && (
            <p className="small mt-1">
              {visits.length} {visits.length === 1 ? "visit" : "visits"}
              {draftCount > 0 && (
                <>
                  <span className="text-fg3"> · </span>
                  {draftCount} awaiting review
                </>
              )}
            </p>
          )}
        </div>

        <div className="relative w-full max-w-xs">
          <Search
            size={16}
            className="text-fg3 pointer-events-none absolute left-3 top-1/2 -translate-y-1/2"
          />
          <input
            className="input"
            style={{ paddingLeft: "2.25rem" }}
            placeholder="Search by name, reference, phone..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="mt-6">
        {isLoading && <SkeletonGrid />}
        {isError && (
          <div className="card p-6 small" style={{ color: "var(--danger)" }}>
            Couldn&apos;t load visits: {(error as Error).message}
          </div>
        )}
        {!isLoading && !isError && filtered.length === 0 && (
          <div className="card p-8 text-center">
            <p className="body-lg">No visits yet</p>
            <p className="small mt-1">Create a new visit to draft your first note.</p>
          </div>
        )}
        {!isLoading && !isError && filtered.length > 0 && (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filtered.map((v) => (
              <VisitCard key={v.id} visit={v} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function SkeletonGrid() {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="card p-5 shimmer">
          <div className="h-5 w-28 rounded" style={{ background: "var(--surface-3)" }} />
          <div className="mt-4 h-4 w-40 rounded" style={{ background: "var(--surface-3)" }} />
        </div>
      ))}
    </div>
  );
}
