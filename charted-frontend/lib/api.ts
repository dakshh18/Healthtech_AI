const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

export const TOKEN_KEY = "charted-token";
export const USER_KEY = "charted-user";

// Attach the stored JWT to every request (no-op during SSR).
function authHeaders(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const token = window.localStorage.getItem(TOKEN_KEY);
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = {
    ...((init.headers as Record<string, string>) ?? {}),
    ...authHeaders(),
  };
  const res = await fetch(`${BASE}${path}`, { ...init, headers });

  if (!res.ok) {
    // An expired/invalid token on a protected route: clear it and bounce to
    // login. Auth routes are exempt so a bad password doesn't trigger a redirect.
    if (res.status === 401 && typeof window !== "undefined" && !path.startsWith("/api/auth")) {
      window.localStorage.removeItem(TOKEN_KEY);
      window.localStorage.removeItem(USER_KEY);
      if (window.location.pathname !== "/login") window.location.href = "/login";
    }
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error || `Request failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  get: <T>(path: string) => request<T>(path),

  post: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: "POST",
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    }),

  patch: <T>(path: string, body: unknown) =>
    request<T>(path, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),

  postForm: <T>(path: string, form: FormData) =>
    request<T>(path, { method: "POST", body: form }),
};
