import { TriangleAlert } from "lucide-react";

export function ConfidenceFlag({ reason }: { reason: string }) {
  return (
    <span className="pill-warn" title={reason}>
      <TriangleAlert size={13} />
      low confidence — verify
    </span>
  );
}
