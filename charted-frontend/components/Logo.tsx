import Link from "next/link";

// The mark is a pulse line resolving into a check — "signal in, reviewed out".
// Inline SVG so it picks up the themed CSS variables.
export function Logo({ withWordmark = true }: { withWordmark?: boolean }) {
  return (
    <Link href="/" className="flex items-center gap-3" aria-label="Charted home">
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none" aria-hidden>
        <rect width="32" height="32" rx="8" fill="var(--primary)" />
        <path
          d="M6 18.5h3.4l2-5.2 2.6 8.2 2-4.2 1.4 2.2H21"
          stroke="var(--primary-fg)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="m20.4 17.6 2.2 2.4 4-5"
          stroke="var(--primary-fg)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {withWordmark && (
        <span className="h2" style={{ fontWeight: 600 }}>
          Charted
        </span>
      )}
    </Link>
  );
}
