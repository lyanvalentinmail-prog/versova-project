import { pool } from './db.js';

export interface WarningRow {
  id: number;
  wa_id: string;
  reason: string;
  admin_id: string;
  created_at: Date;
}

export async function addWarning(groupId: string, waId: string, reason: string, adminId: string): Promise<number> {
  await pool.query(
    'INSERT INTO warnings (group_id, wa_id, reason, admin_id) VALUES ($1,$2,$3,$4)',
    [groupId, waId, reason, adminId],
  );
  return countWarnings(groupId, waId);
}

export async function listWarnings(groupId: string, waId: string): Promise<WarningRow[]> {
  const r = await pool.query<WarningRow>(
    'SELECT id, wa_id, reason, admin_id, created_at FROM warnings WHERE group_id = $1 AND wa_id = $2 ORDER BY created_at',
    [groupId, waId],
  );
  return r.rows;
}

export async function countWarnings(groupId: string, waId: string): Promise<number> {
  const r = await pool.query<{ n: string }>('SELECT COUNT(*)::text AS n FROM warnings WHERE group_id = $1 AND wa_id = $2', [groupId, waId]);
  return Number(r.rows[0].n);
}

/** Quita la advertencia más reciente. */
export async function removeLastWarning(groupId: string, waId: string): Promise<boolean> {
  const r = await pool.query(
    `DELETE FROM warnings WHERE id = (
       SELECT id FROM warnings WHERE group_id = $1 AND wa_id = $2 ORDER BY created_at DESC LIMIT 1)`,
    [groupId, waId],
  );
  return (r.rowCount ?? 0) > 0;
}
