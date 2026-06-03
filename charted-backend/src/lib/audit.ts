import { pool } from "../db/pool";

export type AuditAction = "transcribed" | "structured" | "edited" | "approved";

export async function writeAudit(
  visitId: string,
  action: AuditAction,
  actor: string,
  detail?: unknown
): Promise<void> {
  await pool.query(
    `insert into audit_log (visit_id, action, actor, detail) values ($1, $2, $3, $4)`,
    [visitId, action, actor, detail ? JSON.stringify(detail) : null]
  );
}
