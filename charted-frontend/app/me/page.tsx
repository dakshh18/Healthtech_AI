"use client";

import { AppShell } from "@/components/AppShell";
import { PatientChart } from "@/components/PatientChart";

export default function MyRecordsPage() {
  return (
    <AppShell roles={["PATIENT"]}>
      <PatientChart id="me" />
    </AppShell>
  );
}
