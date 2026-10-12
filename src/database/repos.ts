import type pg from 'pg';
import { pool } from './db.js';

type Q = Pick<pg.PoolClient, 'query'>;

export interface Character {
  id: number;
  group_id: string;
  name: string;
  name_key: string;
  status: 'free' | 'occupied';
  owner_id: string | null;
  reserved_by: string | null;
  reserved_until: Date | null;
}

export interface UserRow {
  group_id: string;
  wa_id: string;
  name: string;
  age: number;
  character_id: number | null;
  partner_id: string | null;
  partner_since: Date | null;
  registered_at: Date;
}

export interface MemberRow {
  group_id: string;
  wa_id: string;
  push_name: string;
  last_activity_at: Date;
  afk_reason: string | null;
  afk_since: Date | null;
}

export interface RequestRow {
  id: number;
  group_id: string;
  user_id: string;
  type: 'rol' | 'cambio' | 'pareja';
  character_id: number | null;
  target_id: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  wa_message_id: string | null;
  created_at: Date;
}

// ---------- grupos ----------
export async function ensureGroup(groupId: string, name: string): Promise<void> {
  await pool.query(
    `INSERT INTO groups (id, name) VALUES ($1, $2)
     ON CONFLICT (id) DO UPDATE SET name = CASE WHEN $2 <> '' THEN $2 ELSE groups.name END, updated_at = now()`,
    [groupId, name],
  );
}

export async function getGroup(groupId: string): Promise<{ name: string; admins: string[]; created_at: Date } | null> {
  const r = await pool.query('SELECT name, admins, created_at FROM groups WHERE id = $1', [groupId]);
  return r.rows[0] ?? null;
}

export async function saveGroupAdmins(groupId: string, admins: string[]): Promise<void> {
  await pool.query('UPDATE groups SET admins = $2, updated_at = now() WHERE id = $1', [groupId, JSON.stringify(admins)]);
}

// ---------- miembros (actividad / AFK) ----------
export async function touchMember(groupId: string, waId: string, pushName: string): Promise<MemberRow> {
  const r = await pool.query<MemberRow>(
    `INSERT INTO members (group_id, wa_id, push_name, last_activity_at)
     VALUES ($1, $2, $3, now())
     ON CONFLICT (group_id, wa_id) DO UPDATE
       SET last_activity_at = now(),
           push_name = CASE WHEN $3 <> '' THEN $3 ELSE members.push_name END
     RETURNING *`,
    [groupId, waId, pushName],
  );
  return r.rows[0];
}

export async function getMember(groupId: string, waId: string, q: Q = pool): Promise<MemberRow | null> {
  const r = await q.query<MemberRow>('SELECT * FROM members WHERE group_id = $1 AND wa_id = $2', [groupId, waId]);
  return r.rows[0] ?? null;
}

export async function setAfk(groupId: string, waId: string, reason: string): Promise<void> {
  await pool.query('UPDATE members SET afk_reason = $3, afk_since = now() WHERE group_id = $1 AND wa_id = $2', [
    groupId,
    waId,
    reason,
  ]);
}

export async function clearAfk(groupId: string, waId: string): Promise<void> {
  await pool.query('UPDATE members SET afk_reason = NULL, afk_since = NULL WHERE group_id = $1 AND wa_id = $2', [
    groupId,
    waId,
  ]);
}

export async function listMembers(groupId: string): Promise<MemberRow[]> {
  const r = await pool.query<MemberRow>('SELECT * FROM members WHERE group_id = $1', [groupId]);
  return r.rows;
}

// ---------- usuarios registrados ----------
export async function getUser(groupId: string, waId: string, q: Q = pool): Promise<UserRow | null> {
  const r = await q.query<UserRow>('SELECT * FROM users WHERE group_id = $1 AND wa_id = $2', [groupId, waId]);
  return r.rows[0] ?? null;
}

export async function listUsers(groupId: string): Promise<UserRow[]> {
  const r = await pool.query<UserRow>('SELECT * FROM users WHERE group_id = $1 ORDER BY registered_at', [groupId]);
  return r.rows;
}

export async function insertUser(groupId: string, waId: string, name: string, age: number, q: Q = pool): Promise<void> {
  await q.query('INSERT INTO users (group_id, wa_id, name, age) VALUES ($1, $2, $3, $4)', [groupId, waId, name, age]);
}

export async function updateUserProfile(groupId: string, waId: string, name: string, age: number): Promise<void> {
  await pool.query(
    'UPDATE users SET name = $3, age = $4, updated_at = now() WHERE group_id = $1 AND wa_id = $2',
    [groupId, waId, name, age],
  );
}

export async function setUserCharacter(groupId: string, waId: string, characterId: number | null, q: Q = pool): Promise<void> {
  await q.query('UPDATE users SET character_id = $3, updated_at = now() WHERE group_id = $1 AND wa_id = $2', [
    groupId,
    waId,
    characterId,
  ]);
}

export async function deleteUser(groupId: string, waId: string, q: Q = pool): Promise<void> {
  await q.query('DELETE FROM users WHERE group_id = $1 AND wa_id = $2', [groupId, waId]);
}

// ---------- personajes ----------
export async function ensureCharacter(groupId: string, name: string, key: string, q: Q = pool): Promise<Character> {
  await q.query(
    'INSERT INTO characters (group_id, name, name_key) VALUES ($1, $2, $3) ON CONFLICT (group_id, name_key) DO NOTHING',
    [groupId, name, key],
  );
  const r = await q.query<Character>('SELECT * FROM characters WHERE group_id = $1 AND name_key = $2', [groupId, key]);
  return r.rows[0];
}

export async function lockCharacter(characterId: number, q: Q): Promise<Character> {
  const r = await q.query<Character>('SELECT * FROM characters WHERE id = $1 FOR UPDATE', [characterId]);
  return r.rows[0];
}

export async function getCharacterById(characterId: number, q: Q = pool): Promise<Character | null> {
  const r = await q.query<Character>('SELECT * FROM characters WHERE id = $1', [characterId]);
  return r.rows[0] ?? null;
}

export async function setCharacterOwner(characterId: number, ownerId: string | null, q: Q): Promise<void> {
  await q.query(
    `UPDATE characters SET status = $2, owner_id = $3, reserved_by = NULL, reserved_until = NULL, updated_at = now()
     WHERE id = $1`,
    [characterId, ownerId ? 'occupied' : 'free', ownerId],
  );
}

export async function setCharacterReservation(characterId: number, by: string, until: Date, q: Q): Promise<void> {
  await q.query('UPDATE characters SET reserved_by = $2, reserved_until = $3, updated_at = now() WHERE id = $1', [
    characterId,
    by,
    until,
  ]);
}

export async function clearCharacterReservation(characterId: number, q: Q): Promise<void> {
  await q.query('UPDATE characters SET reserved_by = NULL, reserved_until = NULL, updated_at = now() WHERE id = $1', [
    characterId,
  ]);
}

/** Libera reservas vencidas de todos los grupos. Devuelve cuántas se liberaron. */
export async function releaseExpiredReservations(): Promise<number> {
  const r = await pool.query(
    `UPDATE characters SET reserved_by = NULL, reserved_until = NULL, updated_at = now()
     WHERE reserved_until IS NOT NULL AND reserved_until <= now()`,
  );
  return r.rowCount ?? 0;
}

export async function listCharactersOccupied(groupId: string): Promise<Character[]> {
  const r = await pool.query<Character>(
    `SELECT * FROM characters WHERE group_id = $1 AND status = 'occupied' ORDER BY name_key`,
    [groupId],
  );
  return r.rows;
}

// ---------- solicitudes ----------
export async function createRequest(
  groupId: string,
  userId: string,
  type: RequestRow['type'],
  characterId: number | null,
  targetId: string | null = null,
  q: Q = pool,
): Promise<number> {
  const r = await q.query<{ id: number }>(
    `INSERT INTO requests (group_id, user_id, type, character_id, target_id) VALUES ($1,$2,$3,$4,$5) RETURNING id`,
    [groupId, userId, type, characterId, targetId],
  );
  return r.rows[0].id;
}

export async function setRequestMessage(requestId: number, messageId: string): Promise<void> {
  await pool.query('UPDATE requests SET wa_message_id = $2 WHERE id = $1', [requestId, messageId]);
}

export async function findPendingByMessage(groupId: string, messageId: string, q: Q = pool): Promise<RequestRow | null> {
  const r = await q.query<RequestRow>(
    `SELECT * FROM requests WHERE group_id = $1 AND wa_message_id = $2 AND status = 'pending'`,
    [groupId, messageId],
  );
  return r.rows[0] ?? null;
}

export async function hasPendingRequest(groupId: string, userId: string, type: RequestRow['type'], characterId?: number): Promise<boolean> {
  const r = await pool.query(
    `SELECT 1 FROM requests WHERE group_id = $1 AND user_id = $2 AND type = $3 AND status = 'pending'
       AND ($4::int IS NULL OR character_id = $4) LIMIT 1`,
    [groupId, userId, type, characterId ?? null],
  );
  return (r.rowCount ?? 0) > 0;
}

/** Marca una solicitud como resuelta solo si sigue pendiente (evita aprobar dos veces). */
export async function resolveRequest(requestId: number, status: 'approved' | 'rejected' | 'cancelled', by: string, q: Q = pool): Promise<boolean> {
  const r = await q.query(
    `UPDATE requests SET status = $2, resolved_by = $3, resolved_at = now() WHERE id = $1 AND status = 'pending'`,
    [requestId, status, by],
  );
  return (r.rowCount ?? 0) > 0;
}

export async function cancelPendingRequests(groupId: string, userId: string, q: Q = pool): Promise<void> {
  await q.query(
    `UPDATE requests SET status = 'cancelled', resolved_at = now() WHERE group_id = $1 AND user_id = $2 AND status = 'pending'`,
    [groupId, userId],
  );
}

// ---------- ajustes globales ----------
export async function getSetting<T>(key: string): Promise<T | null> {
  const r = await pool.query<{ value: T }>('SELECT value FROM settings WHERE key = $1', [key]);
  return r.rows[0]?.value ?? null;
}

export async function setSetting(key: string, value: unknown): Promise<void> {
  await pool.query(
    'INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value',
    [key, JSON.stringify(value)],
  );
}

// ---------- auditoría ----------
export async function audit(groupId: string | null, actor: string, action: string, target: string | null, details: Record<string, unknown> = {}): Promise<void> {
  await pool.query(
    'INSERT INTO audit_log (group_id, actor, action, target, details) VALUES ($1,$2,$3,$4,$5)',
    [groupId, actor, action, target, JSON.stringify(details)],
  );
}

// ---------- deduplicación ----------
/** true si el mensaje es nuevo y debe procesarse; false si ya se procesó. */
export async function claimMessage(messageId: string): Promise<boolean> {
  const r = await pool.query(
    'INSERT INTO processed_messages (message_id) VALUES ($1) ON CONFLICT DO NOTHING',
    [messageId],
  );
  return (r.rowCount ?? 0) > 0;
}

export async function purgeOldMessages(): Promise<void> {
  await pool.query("DELETE FROM processed_messages WHERE processed_at < now() - interval '3 days'");
}

export async function clearReservationsBy(groupId: string, waId: string, q: Q = pool): Promise<void> {
  await q.query(
    'UPDATE characters SET reserved_by = NULL, reserved_until = NULL, updated_at = now() WHERE group_id = $1 AND reserved_by = $2',
    [groupId, waId],
  );
}

export async function getActiveReservationOf(groupId: string, waId: string, q: Q = pool): Promise<Character | null> {
  const r = await q.query<Character>(
    'SELECT * FROM characters WHERE group_id = $1 AND reserved_by = $2 AND reserved_until > now() LIMIT 1',
    [groupId, waId],
  );
  return r.rows[0] ?? null;
}
