import { Header } from "@/components/Header";
import { ThemeToggle } from "@/components/ThemeToggle";
import { NewVisitForm } from "@/components/NewVisitForm";

export default function NewVisitPage() {
  return (
    <>
      <Header>
        <ThemeToggle />
      </Header>
      <main className="mx-auto max-w-6xl px-6 py-10">
        <NewVisitForm />
      </main>
    </>
  );
}
