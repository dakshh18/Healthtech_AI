export function StatusBadge({ status }: { status: "draft" | "approved" }) {
  if (status === "approved") {
    return <span className="badge badge-approved">Approved</span>;
  }
  return <span className="badge badge-draft">Draft · needs review</span>;
}
