import type { Config } from "tailwindcss";

// Colors map to the design-system CSS variables (see globals.css) so utilities
// like `bg-surface` / `text-fg2` follow the active light/dark theme.
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        page: "var(--bg)",
        surface: "var(--surface)",
        surface2: "var(--surface-2)",
        surface3: "var(--surface-3)",
        hair: "var(--border)",
        hairstrong: "var(--border-strong)",
        fg1: "var(--fg1)",
        fg2: "var(--fg2)",
        fg3: "var(--fg3)",
        primary: "var(--primary)",
        amber: "var(--amber)",
        green: "var(--green)",
        warn: "var(--warn)",
        danger: "var(--danger)",
      },
      fontFamily: {
        sans: ["var(--font-sans)"],
        mono: ["var(--font-mono)"],
      },
    },
  },
  plugins: [],
};

export default config;
