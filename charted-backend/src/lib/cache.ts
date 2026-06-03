import crypto from "node:crypto";

// In-memory, hash-keyed cache so re-running the same redacted transcript
// doesn't re-bill the model. Resets on restart, which is fine for a demo.
const store = new Map<string, unknown>();

export async function cached<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const hash = crypto.createHash("sha256").update(key).digest("hex");
  if (store.has(hash)) return store.get(hash) as T;
  const value = await fn();
  store.set(hash, value);
  return value;
}
