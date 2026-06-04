"use client";

import { VersionHistory } from "@/components/VersionHistory";

export default function HistoryPage({ params }: { params: { id: string } }) {
  return <VersionHistory visitId={params.id} />;
}
