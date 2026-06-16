"use client";

import { AppShell } from "@/components/AppShell";
import { NewVisitForm } from "@/components/NewVisitForm";

export default function NewVisitPage() {
  return (
    <AppShell roles={["DOCTOR", "ADMIN"]}>
      <NewVisitForm />
    </AppShell>
  );
}
