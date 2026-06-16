export function StatusPill({ status }: { status: string }) {
  const s = status.toUpperCase();
  const cls =
    s === "APPROVED" || s === "CONFIRMED" || s === "COMPLETED"
      ? "badge-approved"
      : s === "PENDING" || s === "DRAFT"
      ? "badge-draft"
      : "badge-neutral";
  return <span className={`badge ${cls}`}>{status}</span>;
}
