import type pg from 'pg';
import { pool } from './db.js';
import type { SubBotTier, WebPlan } from './repos-web.js';

type Q = Pick<pg.PoolClient, 'query'>;

export interface CoinLedgerRow {
  id: number;
  user_id: number;
  amount: number;
  kind: string;
  detail: string;
  meta: Record<string, unknown>;
  created_at: Date;
}

export interface CatalogUseRow {
  id: number;
  user_id: number;
  bot_slug: string;
  subbot_id: number | null;
  paid_coins: number;
  created_at: Date;
}

export interface CoinItemRow {
  id: string;
  name: string;
  description: string;
  price_coins: number;
  kind: 'space' | 'token' | 'plan' | 'premium-feature';
  payload: Record<string, unknown>;
  badge: string | null;
  available: boolean;
  sort: number;
}

export interface ServerRow {
  id: string;
  name: string;
  provider: string;
  region: string;
  capacity: number;
  used: number;
  cpu: number;
  ram: number;
  disk: number;
  status: 'online' | 'full' | 'maintenance';
  ip: string;
}

export interface ReportRow {
  id: number;
  user_id: number | null;
  kind: 'report' | 'suggestion';
  username: string;
  whatsapp: string;
  text: string;
  status: 'pending' | 'reviewing' | 'done';
  created_at: Date;
}

export interface SubBotGroupRow {
  id: number;
  subbot_id: number;
  group_jid: string;
  name: string;
  members: number;
  active: boolean;
  updated_at: Date;
}

/* ------------------------------- economía ------------------------------- */

/** Suma (o resta) monedas y deja el movimiento en el historial. Devuelve el saldo nuevo. */
export async function addCoins(
  userId: number,
  amount: number,
  kind: string,
  detail: string,
  meta: Record<string, unknown> = {},
  q: Q = pool,
): Promise<{ ok: true; coins: number } | { ok: false; coins: number }> {
  if (amount < 0) {
    const current = await q.query<{ coins: number }>('SELECT coins FROM web_users WHERE id = $1 FOR UPDATE', [userId]);
    const coins = current.rows[0]?.coins ?? 0;
    if (coins + amount < 0) return { ok: false, coins };
  }
  const updated = await q.query<{ coins: number }>(
    'UPDATE web_users SET coins = coins + $2, updated_at = now() WHERE id = $1 RETURNING coins',
    [userId, amount],
  );
  const coins = updated.rows[0]?.coins ?? 0;
  await q.query('INSERT INTO coin_ledger (user_id, amount, kind, detail, meta) VALUES ($1, $2, $3, $4, $5::jsonb)', [
    userId,
    amount,
    kind,
    detail,
    JSON.stringify(meta),
  ]);
  return { ok: true, coins };
}

export async function getCoins(userId: number, q: Q = pool): Promise<number> {
  const r = await q.query<{ coins: number }>('SELECT coins FROM web_users WHERE id = $1', [userId]);
  return r.rows[0]?.coins ?? 0;
}

export async function listLedger(userId: number, limit = 30, q: Q = pool): Promise<CoinLedgerRow[]> {
  const r = await q.query<CoinLedgerRow>(
    'SELECT * FROM coin_ledger WHERE user_id = $1 ORDER BY created_at DESC, id DESC LIMIT $2',
    [userId, limit],
  );
  return r.rows;
}

/** Última vez que el usuario reclamó el bono diario. */
export async function lastDailyClaim(userId: number, q: Q = pool): Promise<Date | null> {
  const r = await q.query<{ created_at: Date }>(
    "SELECT created_at FROM coin_ledger WHERE user_id = $1 AND kind = 'daily' ORDER BY created_at DESC LIMIT 1",
    [userId],
  );
  return r.rows[0]?.created_at ?? null;
}

export async function listMissionClaims(userId: number, q: Q = pool): Promise<string[]> {
  const r = await q.query<{ mission_id: string }>('SELECT mission_id FROM mission_claims WHERE user_id = $1', [userId]);
  return r.rows.map((row) => row.mission_id);
}

export async function claimMission(
  userId: number,
  missionId: string,
  reward: number,
  q: Q = pool,
): Promise<boolean> {
  const r = await q.query(
    'INSERT INTO mission_claims (user_id, mission_id, reward) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
    [userId, missionId, reward],
  );
  return (r.rowCount ?? 0) > 0;
}

/* ------------------------- catálogo de bots (web) ------------------------ */

export interface CatalogRow {
  slug: string;
  name: string;
  emoji: string;
  tagline: string;
  description: string;
  category: string;
  pricing: 'free' | 'coins' | 'usd';
  price_coins: number;
  price_usd: string;
  badge: string | null;
  accent: string;
  features: string[];
  commands: string[];
  popularity: number;
  featured: boolean;
  active: boolean;
  sort: number;
}

export async function listCatalogItems(q: Q = pool): Promise<CatalogRow[]> {
  const r = await q.query<CatalogRow>('SELECT * FROM bot_catalog WHERE active = true ORDER BY sort ASC, name ASC');
  return r.rows;
}

export async function listCatalogUses(userId: number, q: Q = pool): Promise<CatalogUseRow[]> {
  const r = await q.query<CatalogUseRow>('SELECT * FROM catalog_uses WHERE user_id = $1 ORDER BY created_at DESC', [
    userId,
  ]);
  return r.rows;
}

export async function createCatalogUse(
  data: { userId: number; slug: string; subbotId: number | null; paidCoins: number },
  q: Q = pool,
): Promise<CatalogUseRow> {
  const r = await q.query<CatalogUseRow>(
    `INSERT INTO catalog_uses (user_id, bot_slug, subbot_id, paid_coins)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (user_id, bot_slug) DO UPDATE SET subbot_id = COALESCE(EXCLUDED.subbot_id, catalog_uses.subbot_id)
     RETURNING *`,
    [data.userId, data.slug, data.subbotId, data.paidCoins],
  );
  return r.rows[0];
}

export async function countCatalogUses(slug: string, q: Q = pool): Promise<number> {
  const r = await q.query<{ total: number }>('SELECT count(*)::int AS total FROM catalog_uses WHERE bot_slug = $1', [slug]);
  return r.rows[0]?.total ?? 0;
}

/* --------------------------- tienda de monedas --------------------------- */

export async function listCoinItems(q: Q = pool): Promise<CoinItemRow[]> {
  const r = await q.query<CoinItemRow>('SELECT * FROM coin_items WHERE available = true ORDER BY sort ASC');
  return r.rows;
}

export async function getCoinItem(id: string, q: Q = pool): Promise<CoinItemRow | null> {
  const r = await q.query<CoinItemRow>('SELECT * FROM coin_items WHERE id = $1', [id]);
  return r.rows[0] ?? null;
}

/* ------------------------------ servidores ------------------------------ */

export async function listServers(q: Q = pool): Promise<ServerRow[]> {
  const r = await q.query<ServerRow>('SELECT * FROM platform_servers ORDER BY id ASC');
  return r.rows;
}

export async function getServer(id: string, q: Q = pool): Promise<ServerRow | null> {
  const r = await q.query<ServerRow>('SELECT * FROM platform_servers WHERE id = $1', [id]);
  return r.rows[0] ?? null;
}

/* --------------------------- grupos de cada bot -------------------------- */

export async function listSubBotGroups(subbotId: number, q: Q = pool): Promise<SubBotGroupRow[]> {
  const r = await q.query<SubBotGroupRow>(
    'SELECT * FROM subbot_groups WHERE subbot_id = $1 ORDER BY members DESC, name ASC',
    [subbotId],
  );
  return r.rows;
}

export async function upsertSubBotGroup(
  subbotId: number,
  group: { jid: string; name: string; members: number; active?: boolean },
  q: Q = pool,
): Promise<void> {
  await q.query(
    `INSERT INTO subbot_groups (subbot_id, group_jid, name, members, active)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (subbot_id, group_jid) DO UPDATE SET
       name = EXCLUDED.name, members = EXCLUDED.members, active = EXCLUDED.active, updated_at = now()`,
    [subbotId, group.jid, group.name, group.members, group.active ?? true],
  );
}

export async function deleteSubBotGroup(subbotId: number, jid: string, q: Q = pool): Promise<void> {
  await q.query('DELETE FROM subbot_groups WHERE subbot_id = $1 AND group_jid = $2', [subbotId, jid]);
}

/* ------------------------------- reportes ------------------------------- */

export async function createReport(
  data: { userId: number | null; kind: 'report' | 'suggestion'; username: string; whatsapp: string; text: string },
  q: Q = pool,
): Promise<ReportRow> {
  const r = await q.query<ReportRow>(
    `INSERT INTO reports (user_id, kind, username, whatsapp, text)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [data.userId, data.kind, data.username, data.whatsapp, data.text],
  );
  return r.rows[0];
}

export async function listReports(userId: number | null, q: Q = pool): Promise<ReportRow[]> {
  const r = userId
    ? await q.query<ReportRow>('SELECT * FROM reports WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50', [userId])
    : await q.query<ReportRow>('SELECT * FROM reports ORDER BY created_at DESC LIMIT 50');
  return r.rows;
}

/* --------------------------- totales públicos --------------------------- */

export interface PlatformCounts {
  totalBots: number;
  main: number;
  premium: number;
  subs: number;
  users: number;
  tokens: number;
  catalogUses: number;
  online: number;
}

export async function getPlatformCounts(q: Q = pool): Promise<PlatformCounts> {
  const r = await q.query<{
    total_bots: number;
    main: number;
    premium: number;
    subs: number;
    users: number;
    tokens: number;
    catalog_uses: number;
    online: number;
  }>(`
    SELECT
      (SELECT count(*)::int FROM subbots) AS total_bots,
      (SELECT count(*)::int FROM subbots WHERE tier = 'vip') AS main,
      (SELECT count(*)::int FROM subbots WHERE tier = 'premium') AS premium,
      (SELECT count(*)::int FROM subbots WHERE tier = 'free') AS subs,
      (SELECT count(*)::int FROM web_users) AS users,
      (SELECT count(*)::int FROM store_tokens) AS tokens,
      (SELECT count(*)::int FROM catalog_uses) AS catalog_uses,
      (SELECT count(*)::int FROM subbots WHERE status = 'online') AS online
  `);
  const row = r.rows[0];
  // Number() deja los totales como números aunque el controlador devuelva texto o un arreglo.
  return {
    totalBots: Number(row?.total_bots ?? 0),
    main: Number(row?.main ?? 0),
    premium: Number(row?.premium ?? 0),
    subs: Number(row?.subs ?? 0),
    users: Number(row?.users ?? 0),
    tokens: Number(row?.tokens ?? 0),
    catalogUses: Number(row?.catalog_uses ?? 0),
    online: Number(row?.online ?? 0),
  };
}

export type { SubBotTier, WebPlan };
