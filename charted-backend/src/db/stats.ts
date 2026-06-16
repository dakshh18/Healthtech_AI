import { pool } from "./pool";


export type AdminStats = {
  usersByRole: Record<string, number>;
  visitsByStatus: Record<string, number>;
  appointmentsByStatus: Record<string, number>;
  prescriptions: number;
};

type CountByRole = { role: string; n: number };
type CountByStatus = { status: string; n: number };

function toMap<T extends Record<string, unknown>>(
  rows: T[],
  key: keyof T
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of rows) out[String(r[key])] = Number(r.n);
  return out;
}

export async function getAdminStats(): Promise<AdminStats> {
  const [users, visits, appts, rx] = await Promise.all([
    pool.query<CountByRole>(`select role, count(*)::int as n from users group by role`),
    pool.query<CountByStatus>(`select status, count(*)::int as n from visits group by status`),
    pool.query<CountByStatus>(`select status, count(*)::int as n from appointments group by status`),
    pool.query<{ n: number }>(`select count(*)::int as n from prescriptions`),
  ]);

  return {
    usersByRole: toMap(users.rows, "role"),
    visitsByStatus: toMap(visits.rows, "status"),
    appointmentsByStatus: toMap(appts.rows, "status"),
    prescriptions: Number(rx.rows[0].n),
  };
}
