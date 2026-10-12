/**
 * Implementación en memoria de las consultas que usa la web.
 *
 * Se activa cuando no hay DATABASE_URL (`config.database.memory`). Sirve para
 * probar la plataforma completa (cuentas, economía, catálogo, bots, reportes)
 * sin levantar PostgreSQL. Los datos se pierden al reiniciar el proceso.
 */
import { randomBytes, randomUUID, scryptSync } from 'node:crypto';
import type {
  CoinItemRow,
  CoinLedgerRow,
  CatalogRow,
  CatalogUseRow,
  PlatformCounts,
  ReportRow,
  ServerRow,
  SubBotGroupRow,
} from './repos-platform.js';
import type { PurchaseRow, SubBotOptionsPatch, SubBotRow, SubBotTier, TokenRow, WebPlan, WebUser } from './repos-web.js';
import { BOT_CATALOG, COIN_ITEMS, PLATFORM_SERVERS } from '../web/platform-data.js';

interface SessionRow {
  token: string;
  user_id: number;
  expires_at: Date;
}

interface MemoryState {
  users: WebUser[];
  sessions: SessionRow[];
  tokens: TokenRow[];
  subbots: SubBotRow[];
  purchases: Array<PurchaseRow & { user_id: number }>;
  ledger: CoinLedgerRow[];
  catalogUses: CatalogUseRow[];
  groups: SubBotGroupRow[];
  reports: ReportRow[];
  missions: Array<{ user_id: number; mission_id: string; reward: number }>;
  settings: Map<string, unknown>;
  audits: Array<{ group_id: string | null; actor: string; action: string; target: string | null; details: Record<string, unknown>; created_at: Date }>;
  ids: Record<'user' | 'token' | 'bot' | 'purchase' | 'ledger' | 'use' | 'group' | 'report', number>;
}

const state: MemoryState = {
  users: [],
  sessions: [],
  tokens: [],
  subbots: [],
  purchases: [],
  ledger: [],
  catalogUses: [],
  groups: [],
  reports: [],
  missions: [],
  settings: new Map(),
  audits: [],
  ids: { user: 0, token: 0, bot: 0, purchase: 0, ledger: 0, use: 0, group: 0, report: 0 },
};

const nextId = (kind: keyof MemoryState['ids']): number => (state.ids[kind] += 1);
const now = (): Date => new Date();

function hashMemoryPassword(password: string): string {
  const salt = randomBytes(16);
  const derived = scryptSync(password, salt, 64);
  return `scrypt:${salt.toString('hex')}:${derived.toString('hex')}`;
}

function emptyBot(): SubBotRow {
  return {
    id: 0,
    user_id: 0,
    name: '',
    tier: 'free',
    token_code: null,
    phone: '',
    description: '',
    status: 'offline',
    extra_gb: 0,
    bot_type: 'versova',
    display_name: '',
    bot_prefix: '.',
    banner_text: '',
    short_name: '',
    long_name: '',
    currency: '',
    owner_number: '',
    owner_hidden: true,
    bot_link: '',
    channel_url: '',
    prefixes: ['.'],
    banner_url: '',
    username: '',
    status_info: 'online',
    instance_type: 'subbot',
    server_id: 'vrsov-01',
    server_name: 'Vrsov Srv Asuna',
    pairing_code: null,
    pairing_expires_at: null,
    linked_at: null,
    synced_at: null,
    uptime_seconds: 0,
    avatar_url: '',
    catalog_slug: 'versova',
    created_at: now(),
    updated_at: now(),
  };
}

/* ------------------- datos de demostración (solo memoria) ------------------ */

function seedDemo(): void {
  if (state.users.length) return;
  const user: WebUser = {
    id: nextId('user'),
    email: 'demo@versova.app',
    name: 'Demo',
    picture: null,
    google_sub: null,
    password_hash: hashMemoryPassword('versova'),
    plan: 'premium',
    extra_space_gb: 4,
    coins: 1500,
    handle: 'demo',
    avatar_url: null,
    theme: 'dark',
    created_at: now(),
  };
  state.users.push(user);
  state.ledger.push({
    id: nextId('ledger'),
    user_id: user.id,
    amount: 1500,
    kind: 'welcome',
    detail: 'Bono de bienvenida de la demo',
    meta: {},
    created_at: now(),
  });

  const bot: SubBotRow = {
    ...emptyBot(),
    id: nextId('bot'),
    user_id: user.id,
    name: 'Mi Bot',
    tier: 'premium',
    phone: '+5987499422',
    description: 'Bot de demostración con la ficha completa.',
    status: 'online',
    bot_prefix: '/',
    display_name: 'Rikka',
    short_name: 'Rikka',
    long_name: 'Rikka Takanashi',
    currency: '¥enes',
    owner_number: '+598 99 000 111',
    owner_hidden: true,
    bot_link: 'https://web.stellarwa.xyz/cmds',
    channel_url: 'https://whatsapp.com/channel/0029VbAp',
    prefixes: ['/', '#'],
    banner_url: 'https://cloud.stellarwa.xyz/2W85lUvl.jpeg',
    username: 'versova',
    status_info: 'online',
    instance_type: 'subbot',
    server_id: 'vrsov-01',
    server_name: 'Vrsov Srv Asuna',
    synced_at: now(),
    linked_at: now(),
  };
  state.subbots.push(bot);
  state.groups.push({
    id: nextId('group'),
    subbot_id: bot.id,
    group_jid: '120363000000000000@g.us',
    name: '◢禍◣ Versova ࿙☕࿚',
    members: 42,
    active: true,
    updated_at: now(),
  });
  state.catalogUses.push({
    id: nextId('use'),
    user_id: user.id,
    bot_slug: 'versova',
    subbot_id: bot.id,
    paid_coins: 0,
    created_at: now(),
  });
}

seedDemo();

/* ------------------------------- usuarios ------------------------------- */

export async function findUserByEmail(email: string): Promise<WebUser | null> {
  const target = email.trim().toLowerCase();
  return state.users.find((user) => user.email === target) ?? null;
}

export async function findUserByGoogleSub(sub: string): Promise<WebUser | null> {
  return state.users.find((user) => user.google_sub === sub) ?? null;
}

export async function findUserById(id: number): Promise<WebUser | null> {
  return state.users.find((user) => user.id === id) ?? null;
}

export async function createUser(data: {
  email: string;
  name: string;
  passwordHash?: string | null;
  googleSub?: string | null;
  picture?: string | null;
}): Promise<WebUser> {
  const user: WebUser = {
    id: nextId('user'),
    email: data.email.trim().toLowerCase(),
    name: data.name,
    picture: data.picture ?? null,
    google_sub: data.googleSub ?? null,
    password_hash: data.passwordHash ?? null,
    plan: 'free',
    extra_space_gb: 0,
    coins: 250,
    handle: null,
    avatar_url: null,
    theme: 'dark',
    created_at: now(),
  };
  state.users.push(user);
  state.ledger.push({
    id: nextId('ledger'),
    user_id: user.id,
    amount: 250,
    kind: 'welcome',
    detail: 'Bono de bienvenida',
    meta: {},
    created_at: now(),
  });
  return user;
}

export async function linkGoogleToUser(userId: number, googleSub: string, picture: string | null): Promise<void> {
  const user = await findUserById(userId);
  if (!user) return;
  user.google_sub = googleSub;
  if (picture) user.picture = picture;
}

export async function updateUserPlan(userId: number, plan: WebPlan): Promise<void> {
  const user = await findUserById(userId);
  if (user) user.plan = plan;
}

export async function addExtraSpace(userId: number, gb: number): Promise<void> {
  const user = await findUserById(userId);
  if (user) user.extra_space_gb += gb;
}

/* -------------------------------- sesiones ------------------------------- */

export async function createSession(token: string, userId: number, expiresAt: Date): Promise<void> {
  state.sessions.push({ token, user_id: userId, expires_at: expiresAt });
}

export async function getSessionUser(token: string): Promise<WebUser | null> {
  const session = state.sessions.find((row) => row.token === token && row.expires_at.getTime() > Date.now());
  return session ? findUserById(session.user_id) : null;
}

export async function deleteSession(token: string): Promise<void> {
  state.sessions = state.sessions.filter((row) => row.token !== token);
}

export async function purgeExpiredSessions(): Promise<number> {
  const before = state.sessions.length;
  state.sessions = state.sessions.filter((row) => row.expires_at.getTime() > Date.now());
  return before - state.sessions.length;
}

/* -------------------------------- tokens -------------------------------- */

export async function createTokens(
  items: Array<{ code: string; type: 'premium' | 'vip'; spaceGb: number; ownerId: number }>,
): Promise<TokenRow[]> {
  const created = items.map((item) => {
    const row: TokenRow = {
      code: item.code,
      type: item.type,
      space_gb: item.spaceGb,
      status: 'unused',
      owner_id: item.ownerId,
      redeemed_by_bot: null,
      created_at: now(),
      redeemed_at: null,
    };
    state.tokens.push(row);
    return row;
  });
  return created;
}

export async function getTokenByCode(code: string): Promise<TokenRow | null> {
  const target = code.trim().toUpperCase();
  return state.tokens.find((row) => row.code === target) ?? null;
}

export async function redeemToken(code: string, userId: number, botId: number): Promise<TokenRow | null> {
  const token = await getTokenByCode(code);
  if (!token || token.owner_id !== userId || token.status !== 'unused') return null;
  token.status = 'redeemed';
  token.redeemed_by_bot = botId;
  token.redeemed_at = now();
  return token;
}

export async function listTokensByOwner(userId: number): Promise<TokenRow[]> {
  return state.tokens.filter((row) => row.owner_id === userId).slice().reverse();
}

export async function countUnusedTokens(userId: number, type: 'premium' | 'vip'): Promise<number> {
  return state.tokens.filter((row) => row.owner_id === userId && row.type === type && row.status === 'unused').length;
}

/* -------------------------------- sub-bots ------------------------------- */

export async function createSubBot(data: {
  userId: number;
  name: string;
  tier: SubBotTier;
  tokenCode: string | null;
  phone: string;
  description: string;
  botType?: string;
  displayName?: string;
  botPrefix?: string;
  bannerText?: string;
  shortName?: string;
  longName?: string;
  currency?: string;
  ownerNumber?: string;
  ownerHidden?: boolean;
  botLink?: string;
  channelUrl?: string;
  prefixes?: string[];
  bannerUrl?: string;
  username?: string;
  statusInfo?: string;
  instanceType?: string;
  serverId?: string;
  serverName?: string;
  avatarUrl?: string;
  catalogSlug?: string;
}): Promise<SubBotRow> {
  const bot: SubBotRow = {
    ...emptyBot(),
    id: nextId('bot'),
    user_id: data.userId,
    name: data.name,
    tier: data.tier,
    token_code: data.tokenCode,
    phone: data.phone,
    description: data.description,
    bot_type: data.botType ?? 'versova',
    display_name: data.displayName ?? '',
    bot_prefix: data.botPrefix ?? '.',
    banner_text: data.bannerText ?? '',
    short_name: data.shortName ?? '',
    long_name: data.longName ?? '',
    currency: data.currency ?? '',
    owner_number: data.ownerNumber ?? '',
    owner_hidden: data.ownerHidden ?? true,
    bot_link: data.botLink ?? '',
    channel_url: data.channelUrl ?? '',
    prefixes: data.prefixes ?? ['.'],
    banner_url: data.bannerUrl ?? '',
    username: data.username ?? '',
    status_info: data.statusInfo ?? 'online',
    instance_type: data.instanceType ?? 'subbot',
    server_id: data.serverId ?? 'vrsov-01',
    server_name: data.serverName ?? 'Vrsov Srv Asuna',
    avatar_url: data.avatarUrl ?? '',
    catalog_slug: data.catalogSlug ?? 'versova',
  };
  state.subbots.push(bot);
  return bot;
}

export async function listSubBots(userId: number): Promise<SubBotRow[]> {
  return state.subbots.filter((bot) => bot.user_id === userId).slice().reverse();
}

export async function getSubBot(id: number, userId: number): Promise<SubBotRow | null> {
  return state.subbots.find((bot) => bot.id === id && bot.user_id === userId) ?? null;
}

function applyPatch<T extends Record<string, unknown>>(target: T, patch: Record<string, unknown>, map: Record<string, string>): void {
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue;
    const column = map[key] ?? key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
    target[column as keyof T] = value as T[keyof T];
  }
}

const BOT_PATCH_MAP: Record<string, string> = {
  extraGb: 'extra_gb',
  botType: 'bot_type',
  displayName: 'display_name',
  botPrefix: 'bot_prefix',
  bannerText: 'banner_text',
  shortName: 'short_name',
  longName: 'long_name',
  ownerNumber: 'owner_number',
  ownerHidden: 'owner_hidden',
  botLink: 'bot_link',
  channelUrl: 'channel_url',
  bannerUrl: 'banner_url',
  statusInfo: 'status_info',
  instanceType: 'instance_type',
  serverId: 'server_id',
  serverName: 'server_name',
  avatarUrl: 'avatar_url',
  catalogSlug: 'catalog_slug',
};

export async function updateSubBot(
  id: number,
  userId: number,
  patch: SubBotOptionsPatch,
): Promise<SubBotRow | null> {
  const bot = await getSubBot(id, userId);
  if (!bot) return null;
  applyPatch(bot as unknown as Record<string, unknown>, patch as Record<string, unknown>, BOT_PATCH_MAP);
  bot.updated_at = now();
  return bot;
}

export const updateSubBotOptions = updateSubBot;

export async function deleteSubBot(id: number, userId: number): Promise<boolean> {
  const before = state.subbots.length;
  state.subbots = state.subbots.filter((bot) => !(bot.id === id && bot.user_id === userId));
  state.groups = state.groups.filter((group) => group.subbot_id !== id);
  return state.subbots.length < before;
}

export async function countSubBots(userId: number): Promise<number> {
  return state.subbots.filter((bot) => bot.user_id === userId).length;
}

export async function allocatedExtraGb(userId: number, excludeBotId?: number): Promise<number> {
  return state.subbots
    .filter((bot) => bot.user_id === userId && bot.id !== excludeBotId)
    .reduce((total, bot) => total + bot.extra_gb, 0);
}

export async function setSubBotPairing(
  id: number,
  userId: number,
  code: string | null,
  expiresAt: Date | null,
): Promise<SubBotRow | null> {
  const bot = await getSubBot(id, userId);
  if (!bot) return null;
  bot.pairing_code = code;
  bot.pairing_expires_at = expiresAt;
  bot.updated_at = now();
  return bot;
}

export async function markSubBotLinked(id: number, userId: number): Promise<SubBotRow | null> {
  const bot = await getSubBot(id, userId);
  if (!bot) return null;
  bot.status = 'online';
  bot.linked_at = now();
  bot.pairing_code = null;
  bot.pairing_expires_at = null;
  bot.uptime_seconds = 0;
  bot.synced_at = now();
  bot.updated_at = now();
  return bot;
}

export async function bumpSubBotUptime(id: number, seconds: number): Promise<void> {
  const bot = state.subbots.find((row) => row.id === id);
  if (bot) bot.uptime_seconds = Math.max(0, Math.floor(seconds));
}

/* ------------------------------- compras -------------------------------- */

export async function recordPurchase(data: {
  userId: number;
  itemId: string;
  itemName: string;
  quantity: number;
  priceUsd: number;
  details?: Record<string, unknown>;
}): Promise<void> {
  state.purchases.push({
    id: nextId('purchase'),
    user_id: data.userId,
    item_id: data.itemId,
    item_name: data.itemName,
    quantity: data.quantity,
    price_usd: data.priceUsd.toFixed(2),
    details: data.details ?? {},
    created_at: now(),
  });
}

export async function listPurchases(userId: number, limit = 25): Promise<PurchaseRow[]> {
  return state.purchases.filter((row) => row.user_id === userId).slice(-limit).reverse();
}

/* ------------------------------- economía ------------------------------- */

export async function addCoins(
  userId: number,
  amount: number,
  kind: string,
  detail: string,
  meta: Record<string, unknown> = {},
): Promise<{ ok: true; coins: number } | { ok: false; coins: number }> {
  const user = await findUserById(userId);
  if (!user) return { ok: false, coins: 0 };
  if (user.coins + amount < 0) return { ok: false, coins: user.coins };
  user.coins += amount;
  state.ledger.push({
    id: nextId('ledger'),
    user_id: userId,
    amount,
    kind,
    detail,
    meta,
    created_at: now(),
  });
  return { ok: true, coins: user.coins };
}

export async function getCoins(userId: number): Promise<number> {
  return (await findUserById(userId))?.coins ?? 0;
}

export async function listLedger(userId: number, limit = 30): Promise<CoinLedgerRow[]> {
  return state.ledger
    .filter((row) => row.user_id === userId)
    .slice()
    .reverse()
    .slice(0, limit);
}

export async function lastDailyClaim(userId: number): Promise<Date | null> {
  const rows = state.ledger.filter((row) => row.user_id === userId && row.kind === 'daily');
  return rows.length ? rows[rows.length - 1].created_at : null;
}

export async function listMissionClaims(userId: number): Promise<string[]> {
  return state.missions.filter((row) => row.user_id === userId).map((row) => row.mission_id);
}

export async function claimMission(userId: number, missionId: string, reward: number): Promise<boolean> {
  if (state.missions.some((row) => row.user_id === userId && row.mission_id === missionId)) return false;
  state.missions.push({ user_id: userId, mission_id: missionId, reward });
  return true;
}

/* ------------------------------- catálogo ------------------------------- */

export async function listCatalogItems(): Promise<CatalogRow[]> {
  return BOT_CATALOG.map((bot) => ({
    slug: bot.slug,
    name: bot.name,
    emoji: bot.emoji,
    tagline: bot.tagline,
    description: bot.description,
    category: bot.category,
    pricing: bot.pricing,
    price_usd: bot.priceUsd.toFixed(2),
    price_coins: bot.priceCoins,
    badge: bot.badge,
    accent: bot.accent,
    features: bot.features,
    commands: bot.commands,
    popularity: bot.popularity,
    featured: bot.featured,
    active: true,
    sort: bot.sort,
  }));
}

export async function listCatalogUses(userId: number): Promise<CatalogUseRow[]> {
  return state.catalogUses.filter((row) => row.user_id === userId);
}

export async function createCatalogUse(data: {
  userId: number;
  slug: string;
  subbotId: number | null;
  paidCoins: number;
}): Promise<CatalogUseRow> {
  const existing = state.catalogUses.find((row) => row.user_id === data.userId && row.bot_slug === data.slug);
  if (existing) {
    if (data.subbotId) existing.subbot_id = data.subbotId;
    return existing;
  }
  const row: CatalogUseRow = {
    id: nextId('use'),
    user_id: data.userId,
    bot_slug: data.slug,
    subbot_id: data.subbotId,
    paid_coins: data.paidCoins,
    created_at: now(),
  };
  state.catalogUses.push(row);
  return row;
}

export async function countCatalogUses(slug: string): Promise<number> {
  return state.catalogUses.filter((row) => row.bot_slug === slug).length;
}

/* --------------------------- tienda de monedas --------------------------- */

function coinRow(item: (typeof COIN_ITEMS)[number]): CoinItemRow {
  return {
    id: item.id,
    name: item.name,
    description: item.description,
    price_coins: item.priceCoins,
    kind: item.kind,
    payload: item.payload,
    badge: item.badge,
    available: item.available,
    sort: item.sort,
  };
}

export async function listCoinItems(): Promise<CoinItemRow[]> {
  return COIN_ITEMS.filter((item) => item.available).map((item) => coinRow(item));
}

export async function getCoinItem(id: string): Promise<CoinItemRow | null> {
  const item = COIN_ITEMS.find((entry) => entry.id === id);
  return item ? coinRow(item) : null;
}

/* ------------------------------ servidores ------------------------------- */

export async function listServers(): Promise<ServerRow[]> {
  return PLATFORM_SERVERS.map((server) => ({ ...server }));
}

export async function getServer(id: string): Promise<ServerRow | null> {
  return PLATFORM_SERVERS.find((server) => server.id === id) ?? null;
}

/* --------------------------- grupos de cada bot -------------------------- */

export async function listSubBotGroups(subbotId: number): Promise<SubBotGroupRow[]> {
  return state.groups.filter((group) => group.subbot_id === subbotId);
}

export async function upsertSubBotGroup(
  subbotId: number,
  group: { jid: string; name: string; members: number; active?: boolean },
): Promise<void> {
  const existing = state.groups.find((row) => row.subbot_id === subbotId && row.group_jid === group.jid);
  if (existing) {
    existing.name = group.name;
    existing.members = group.members;
    existing.active = group.active ?? true;
    existing.updated_at = now();
    return;
  }
  state.groups.push({
    id: nextId('group'),
    subbot_id: subbotId,
    group_jid: group.jid,
    name: group.name,
    members: group.members,
    active: group.active ?? true,
    updated_at: now(),
  });
}

export async function deleteSubBotGroup(subbotId: number, jid: string): Promise<void> {
  state.groups = state.groups.filter((row) => !(row.subbot_id === subbotId && row.group_jid === jid));
}

/* ------------------------------- reportes -------------------------------- */

export async function createReport(data: {
  userId: number | null;
  kind: 'report' | 'suggestion';
  username: string;
  whatsapp: string;
  text: string;
}): Promise<ReportRow> {
  const row: ReportRow = {
    id: nextId('report'),
    user_id: data.userId,
    kind: data.kind,
    username: data.username,
    whatsapp: data.whatsapp,
    text: data.text,
    status: 'pending',
    created_at: now(),
  };
  state.reports.push(row);
  return row;
}

export async function listReports(userId: number | null): Promise<ReportRow[]> {
  const rows = userId ? state.reports.filter((row) => row.user_id === userId) : state.reports;
  return rows.slice().reverse().slice(0, 50);
}

/* ------------------------- totales y ajustes web ------------------------- */

export async function getPlatformCounts(): Promise<PlatformCounts> {
  return {
    totalBots: state.subbots.length,
    main: state.subbots.filter((bot) => bot.tier === 'vip').length,
    premium: state.subbots.filter((bot) => bot.tier === 'premium').length,
    subs: state.subbots.filter((bot) => bot.tier === 'free').length,
    users: state.users.length,
    tokens: state.tokens.length,
    catalogUses: state.catalogUses.length,
    online: state.subbots.filter((bot) => bot.status === 'online').length,
  };
}

export async function getSetting<T>(key: string): Promise<T | null> {
  return (state.settings.get(key) as T | undefined) ?? null;
}

export async function setSetting(key: string, value: unknown): Promise<void> {
  state.settings.set(key, value);
}

export interface MemoryMetrics {
  groups: number;
  members: number;
  activeMembers: number;
  users: number;
  characters: number;
  charactersOccupied: number;
  pendingRequests: number;
  warnings: number;
  actions: number;
  lastActivityAt: string | null;
}

export async function getPlatformMetrics(): Promise<MemoryMetrics> {
  return {
    groups: new Set(state.groups.map((group) => group.group_jid)).size,
    members: state.groups.reduce((total, group) => total + group.members, 0),
    activeMembers: state.groups.reduce((total, group) => total + Math.round(group.members * 0.6), 0),
    users: state.users.length,
    characters: 0,
    charactersOccupied: 0,
    pendingRequests: 0,
    warnings: 0,
    actions: state.audits.length,
    lastActivityAt: now().toISOString(),
  };
}

export async function audit(
  groupId: string | null,
  actor: string,
  action: string,
  target: string | null,
  details: Record<string, unknown> = {},
): Promise<void> {
  state.audits.push({ group_id: groupId, actor, action, target, details, created_at: now() });
}

/** Datos públicos del conjunto de la plataforma (para la portada y el monitor). */
export function memorySnapshot(): { users: WebUser[]; bots: SubBotRow[]; uses: CatalogUseRow[] } {
  return { users: state.users, bots: state.subbots, uses: state.catalogUses };
}

export const randomToken = (): string => randomUUID();
