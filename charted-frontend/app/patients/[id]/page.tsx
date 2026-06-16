"use client";

import { AppShell } from "@/components/AppShell";
import { PatientChart } from "@/components/PatientChart";

export default function PatientHistoryPage({ params }: { params: { id: string } }) {
  return (
    <AppShell roles={["DOCTOR", "ADMIN"]}>
      <PatientChart id={params.id} />
    </AppShell>
  );
}
