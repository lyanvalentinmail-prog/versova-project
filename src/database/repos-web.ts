import type pg from 'pg';
import { pool } from './db.js';

type Q = Pick<pg.PoolClient, 'query'>;

export type WebPlan = 'free' | 'premium' | 'vip';
export type SubBotTier = 'free' | 'premium' | 'vip';
export type TokenType = 'premium' | 'vip';

export interface WebUser {
  id: number;
  email: string;
  name: string;
  picture: string | null;
  google_sub: string | null;
  password_hash: string | null;
  plan: WebPlan;
  extra_space_gb: number;
  created_at: Date;
}

export interface SubBotRow {
  id: number;
  user_id: number;
  name: string;
  tier: SubBotTier;
  token_code: string | null;
  phone: string;
  description: string;
  status: 'online' | 'offline' | 'paused';
  extra_gb: number;
  created_at: Date;
  updated_at: Date;
}

export interface TokenRow {
  code: string;
  type: TokenType;
  space_gb: number;
  status: 'unused' | 'redeemed';
  owner_id: number | null;
  redeemed_by_bot: number | null;
  created_at: Date;
  redeemed_at: Date | null;
}

export interface PurchaseRow {
  id: number;
  item_id: string;
  item_name: string;
  quantity: number;
  price_usd: string;
  details: Record<string, unknown>;
  created_at: Date;
}

// ---------- usuarios de la web ----------
export async function findUserByEmail(email: string, q: Q = pool): Promise<WebUser | null> {
  const r = await q.query<WebUser>('SELECT * FROM web_users WHERE email = $1', [email.trim().toLowerCase()]);
  return r.rows[0] ?? null;
}

export async function findUserByGoogleSub(sub: string, q: Q = pool): Promise<WebUser | null> {
  const r = await q.query<WebUser>('SELECT * FROM web_users WHERE google_sub = $1', [sub]);
  return r.rows[0] ?? null;
}

export async function findUserById(id: number, q: Q = pool): Promise<WebUser | null> {
  const r = await q.query<WebUser>('SELECT * FROM web_users WHERE id = $1', [id]);
  return r.rows[0] ?? null;
}

export async function createUser(
  data: { email: string; name: string; passwordHash?: string | null; googleSub?: string | null; picture?: string | null },
  q: Q = pool,
): Promise<WebUser> {
  const r = await q.query<WebUser>(
    `INSERT INTO web_users (email, name, password_hash, google_sub, picture)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [data.email.trim().toLowerCase(), data.name, data.passwordHash ?? null, data.googleSub ?? null, data.picture ?? null],
  );
  return r.rows[0];
}

export async function linkGoogleToUser(userId: number, googleSub: string, picture: string | null, q: Q = pool): Promise<void> {
  await q.query('UPDATE web_users SET google_sub = $2, picture = COALESCE($3, picture), updated_at = now() WHERE id = $1', [
    userId,
    googleSub,
    picture,
  ]);
}

export async function updateUserPlan(userId: number, plan: WebPlan, q: Q = pool): Promise<void> {
  await q.query('UPDATE web_users SET plan = $2, updated_at = now() WHERE id = $1', [userId, plan]);
}

export async function addExtraSpace(userId: number, gb: number, q: Q = pool): Promise<void> {
  await q.query('UPDATE web_users SET extra_space_gb = extra_space_gb + $2, updated_at = now() WHERE id = $1', [userId, gb]);
}

// ---------- sesiones ----------
export async function createSession(token: string, userId: number, expiresAt: Date, q: Q = pool): Promise<void> {
  await q.query('INSERT INTO web_sessions (token, user_id, expires_at) VALUES ($1, $2, $3)', [token, userId, expiresAt]);
}

export async function getSessionUser(token: string, q: Q = pool): Promise<WebUser | null> {
  const r = await q.query<WebUser>(
    `SELECT u.* FROM web_sessions s JOIN web_users u ON u.id = s.user_id
     WHERE s.token = $1 AND s.expires_at > now()`,
    [token],
  );
  return r.rows[0] ?? null;
}

export async function deleteSession(token: string, q: Q = pool): Promise<void> {
  await q.query('DELETE FROM web_sessions WHERE token = $1', [token]);
}

export async function purgeExpiredSessions(q: Q = pool): Promise<number> {
  const r = await q.query('DELETE FROM web_sessions WHERE expires_at < now()');
  return r.rowCount ?? 0;
}

// ---------- tokens de la tienda ----------
function tokenTypeFor(tier: TokenType): TokenType {
  return tier;
}

export async function createTokens(
  items: Array<{ code: string; type: TokenType; spaceGb: number; ownerId: number }>,
  q: Q = pool,
): Promise<TokenRow[]> {
  const created: TokenRow[] = [];
  for (const item of items) {
    const r = await q.query<TokenRow>(
      `INSERT INTO store_tokens (code, type, space_gb, owner_id) VALUES ($1, $2, $3, $4) RETURNING *`,
      [item.code, tokenTypeFor(item.type), item.spaceGb, item.ownerId],
    );
    created.push(r.rows[0]);
  }
  return created;
}

export async function getTokenByCode(code: string, q: Q = pool): Promise<TokenRow | null> {
  const r = await q.query<TokenRow>('SELECT * FROM store_tokens WHERE code = $1', [code.trim().toUpperCase()]);
  return r.rows[0] ?? null;
}

/** Canjea un token solo si es del usuario y sigue sin usar. Devuelve el token canjeado o null. */
export async function redeemToken(code: string, userId: number, botId: number, q: Q = pool): Promise<TokenRow | null> {
  const r = await q.query<TokenRow>(
    `UPDATE store_tokens SET status = 'redeemed', redeemed_at = now(), redeemed_by_bot = $3
     WHERE code = $1 AND owner_id = $2 AND status = 'unused' RETURNING *`,
    [code.trim().toUpperCase(), userId, botId],
  );
  return r.rows[0] ?? null;
}

export async function listTokensByOwner(userId: number, q: Q = pool): Promise<TokenRow[]> {
  const r = await q.query<TokenRow>('SELECT * FROM store_tokens WHERE owner_id = $1 ORDER BY created_at DESC', [userId]);
  return r.rows;
}

export async function countUnusedTokens(userId: number, type: TokenType, q: Q = pool): Promise<number> {
  const r = await q.query<{ total: number }>(
    "SELECT count(*)::int AS total FROM store_tokens WHERE owner_id = $1 AND type = $2 AND status = 'unused'",
    [userId, type],
  );
  return r.rows[0]?.total ?? 0;
}

// ---------- sub-bots ----------
export async function createSubBot(
  data: { userId: number; name: string; tier: SubBotTier; tokenCode: string | null; phone: string; description: string },
  q: Q = pool,
): Promise<SubBotRow> {
  const r = await q.query<SubBotRow>(
    `INSERT INTO subbots (user_id, name, tier, token_code, phone, description, extra_gb)
     VALUES ($1, $2, $3, $4, $5, $6, 0) RETURNING *`,
    [data.userId, data.name, data.tier, data.tokenCode, data.phone, data.description],
  );
  return r.rows[0];
}

export async function listSubBots(userId: number, q: Q = pool): Promise<SubBotRow[]> {
  const r = await q.query<SubBotRow>('SELECT * FROM subbots WHERE user_id = $1 ORDER BY created_at DESC', [userId]);
  return r.rows;
}

export async function getSubBot(id: number, userId: number, q: Q = pool): Promise<SubBotRow | null> {
  const r = await q.query<SubBotRow>('SELECT * FROM subbots WHERE id = $1 AND user_id = $2', [id, userId]);
  return r.rows[0] ?? null;
}

export async function updateSubBot(
  id: number,
  userId: number,
  patch: { name?: string; phone?: string; description?: string; status?: SubBotRow['status']; extraGb?: number },
  q: Q = pool,
): Promise<SubBotRow | null> {
  const r = await q.query<SubBotRow>(
    `UPDATE subbots SET
       name = COALESCE($3, name),
       phone = COALESCE($4, phone),
       description = COALESCE($5, description),
       status = COALESCE($6, status),
       extra_gb = COALESCE($7, extra_gb),
       updated_at = now()
     WHERE id = $1 AND user_id = $2 RETURNING *`,
    [id, userId, patch.name ?? null, patch.phone ?? null, patch.description ?? null, patch.status ?? null, patch.extraGb ?? null],
  );
  return r.rows[0] ?? null;
}

export async function deleteSubBot(id: number, userId: number, q: Q = pool): Promise<boolean> {
  const r = await q.query('DELETE FROM subbots WHERE id = $1 AND user_id = $2', [id, userId]);
  return (r.rowCount ?? 0) > 0;
}

export async function countSubBots(userId: number, q: Q = pool): Promise<number> {
  const r = await q.query<{ total: number }>('SELECT count(*)::int AS total FROM subbots WHERE user_id = $1', [userId]);
  return r.rows[0]?.total ?? 0;
}

/** GB extra ya repartidos entre los sub-bots (excluyendo uno, para edits). */
export async function allocatedExtraGb(userId: number, excludeBotId?: number, q: Q = pool): Promise<number> {
  const r = await q.query<{ total: number }>(
    'SELECT COALESCE(sum(extra_gb), 0)::int AS total FROM subbots WHERE user_id = $1 AND ($2::int IS NULL OR id <> $2)',
    [userId, excludeBotId ?? null],
  );
  return r.rows[0]?.total ?? 0;
}

// ---------- compras ----------
export async function recordPurchase(
  data: { userId: number; itemId: string; itemName: string; quantity: number; priceUsd: number; details?: Record<string, unknown> },
  q: Q = pool,
): Promise<void> {
  await q.query(
    'INSERT INTO purchases (user_id, item_id, item_name, quantity, price_usd, details) VALUES ($1, $2, $3, $4, $5, $6)',
    [data.userId, data.itemId, data.itemName, data.quantity, data.priceUsd, JSON.stringify(data.details ?? {})],
  );
}

export async function listPurchases(userId: number, limit = 25, q: Q = pool): Promise<PurchaseRow[]> {
  const r = await q.query<PurchaseRow>(
    'SELECT * FROM purchases WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2',
    [userId, limit],
  );
  return r.rows;
}
