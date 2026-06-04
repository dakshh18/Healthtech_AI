"use client";

import { ReviewWorkspace } from "@/components/ReviewWorkspace";

export default function VisitPage({ params }: { params: { id: string } }) {
  return <ReviewWorkspace visitId={params.id} />;
}
