"use client";

import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/lib/auth";
import {
  useAdminStats,
  useAdminUsers,
  useAdminAudit,
  useSetUserRole,
  useSetUserStatus,
} from "@/lib/hooks";
import type { Role, User } from "@/types";

export default function AdminPage() {
  return (
    <AppShell roles={["ADMIN"]}>
      <Dashboard />
    </AppShell>
  );
}

function Dashboard() {
  return (
    <div className="space-y-10">
      <div>
        <h1 className="h1">Admin dashboard</h1>
        <p className="small mt-1">System overview, user management, and activity.</p>
      </div>
      <StatsSection />
      <UsersSection />
      <AuditSection />
    </div>
  );
}

function StatsSection() {
  const { data, isLoading } = useAdminStats();
  if (isLoading || !data) return <p className="small">Loading stats…</p>;
  const s = data.stats;

  const Group = ({ title, map }: { title: string; map: Record<string, number> }) => (
    <div className="card p-5">
      <div className="label">{title}</div>
      <div className="mt-3 space-y-1">
        {Object.entries(map).length === 0 && <div className="small text-fg3">—</div>}
        {Object.entries(map).map(([k, v]) => (
          <div key={k} className="flex items-center justify-between">
            <span className="small">{k}</span>
            <span className="mono">{v}</span>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <section>
      <h2 className="h3">Overview</h2>
      <div className="mt-3 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Group title="Users by role" map={s.usersByRole} />
        <Group title="Visits by status" map={s.visitsByStatus} />
        <Group title="Appointments" map={s.appointmentsByStatus} />
        <div className="card p-5">
          <div className="label">Prescriptions</div>
          <div className="h1 mt-2">{s.prescriptions}</div>
        </div>
      </div>
    </section>
  );
}

function UsersSection() {
  const { user: me } = useAuth();
  const { data, isLoading } = useAdminUsers();
  const setRole = useSetUserRole();
  const setStatus = useSetUserStatus();
  const users = data?.users ?? [];

  return (
    <section>
      <h2 className="h3">Users</h2>
      <div className="card mt-3 overflow-hidden">
        <table className="w-full" style={{ borderCollapse: "collapse" }}>
          <thead>
            <tr className="label" style={{ textAlign: "left" }}>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td className="small px-4 py-3" colSpan={4}>
                  Loading…
                </td>
              </tr>
            )}
            {users.map((u: User) => {
              const isSelf = u.id === me?.id;
              return (
                <tr key={u.id} style={{ borderTop: "1px solid var(--border)" }}>
                  <td className="px-4 py-3 small" style={{ color: "var(--fg1)" }}>
                    {u.name} {isSelf && <span className="label">(you)</span>}
                  </td>
                  <td className="px-4 py-3 small">{u.email}</td>
                  <td className="px-4 py-3">
                    <select
                      className="input"
                      style={{ height: 32, padding: "0 8px", width: "auto" }}
                      value={u.role}
                      disabled={isSelf || setRole.isPending}
                      onChange={(e) => setRole.mutate({ id: u.id, role: e.target.value as Role })}
                    >
                      <option value="PATIENT">PATIENT</option>
                      <option value="DOCTOR">DOCTOR</option>
                      <option value="ADMIN">ADMIN</option>
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      className="btn btn-sm"
                      disabled={isSelf || setStatus.isPending}
                      onClick={() => setStatus.mutate({ id: u.id, isActive: !u.is_active })}
                    >
                      {u.is_active ? "Deactivate" : "Activate"}
                    </button>
                    <span className="small ml-2" style={{ color: u.is_active ? "var(--green)" : "var(--fg3)" }}>
                      {u.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {(setRole.isError || setStatus.isError) && (
        <p className="small mt-2" style={{ color: "var(--danger)" }}>
          {((setRole.error || setStatus.error) as Error)?.message}
        </p>
      )}
    </section>
  );
}

function AuditSection() {
  const { data, isLoading } = useAdminAudit();
  const entries = data?.audit ?? [];

  return (
    <section>
      <h2 className="h3">Recent activity</h2>
      <div className="card mt-3 divide-y" style={{ borderColor: "var(--border)" }}>
        {isLoading && <p className="small p-4">Loading…</p>}
        {!isLoading && entries.length === 0 && <p className="small p-4">No activity recorded.</p>}
        {entries.map((a, i) => (
          <div
            key={i}
            className="flex items-center justify-between px-4 py-3"
            style={{ borderTop: i === 0 ? "none" : "1px solid var(--border)" }}
          >
            <div>
              <span className="mono">{a.action}</span>
              <span className="small"> · {a.actor}</span>
            </div>
            <span className="small">{new Date(a.createdAt).toLocaleString()}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
