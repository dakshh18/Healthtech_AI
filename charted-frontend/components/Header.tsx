import { Logo } from "./Logo";

export function Header({ children }: { children?: React.ReactNode }) {
  return (
    <header className="app-header">
      <Logo />
      <div className="flex items-center gap-3">{children}</div>
    </header>
  );
}
