"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

type Props = {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  autoComplete?: string;
  minLength?: number;
  required?: boolean;
  placeholder?: string;
};

export function PasswordInput({ value, onChange, autoComplete, minLength, required, placeholder }: Props) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative mt-1">
      <input
        className="input"
        style={{ paddingRight: "2.75rem" }}
        type={show ? "text" : "password"}
        value={value}
        onChange={onChange}
        autoComplete={autoComplete}
        minLength={minLength}
        required={required}
        placeholder={placeholder}
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        aria-label={show ? "Hide password" : "Show password"}
        title={show ? "Hide password" : "Show password"}
        className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center justify-center"
        style={{ width: 30, height: 30, color: "var(--fg3)", background: "transparent", border: "none", cursor: "pointer" }}
      >
        {show ? <EyeOff size={17} /> : <Eye size={17} />}
      </button>
    </div>
  );
}
