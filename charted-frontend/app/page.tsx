import Link from "next/link";
import { Plus } from "lucide-react";
import { Header } from "@/components/Header";
import { ThemeToggle } from "@/components/ThemeToggle";
import { VisitList } from "@/components/VisitList";

export default function HomePage() {
  return (
    <>
      <Header>
        <ThemeToggle />
        <Link href="/new" className="btn btn-primary">
          <Plus size={17} />
          New visit
        </Link>
      </Header>
      <main className="mx-auto max-w-6xl px-6 py-8">
        <VisitList />
      </main>
    </>
  );
}
