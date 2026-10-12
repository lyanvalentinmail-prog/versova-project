/**
 * Capa de acceso a datos que usa la web.
 *
 * Con DATABASE_URL delega en PostgreSQL (repos-web / repos-platform / repos).
 * Sin DATABASE_URL usa la implementación en memoria, para que la plataforma se
 * pueda probar completa sin base de datos.
 */
import { memoryMode } from './db.js';
import * as pgWeb from './repos-web.js';
import * as pgPlatform from './repos-platform.js';
import * as pgCore from './repos.js';
import type { PoolClient } from 'pg';
import * as mem from './memory.js';

export type { WebPlan, SubBotTier, TokenType, WebUser, SubBotRow, TokenRow, PurchaseRow } from './repos-web.js';
export type {
  CoinItemRow,
  CoinLedgerRow,
  CatalogRow,
  CatalogUseRow,
  PlatformCounts,
  ReportRow,
  ServerRow,
  SubBotGroupRow,
} from './repos-platform.js';
export type { PlatformMetrics, MemberRow } from './repos.js';

const pick = <T>(pg: T, memory: T): T => (memoryMode ? memory : pg);

/* ------------------------------- usuarios ------------------------------- */
export const findUserByEmail: typeof pgWeb.findUserByEmail = pick(pgWeb.findUserByEmail, mem.findUserByEmail);
export const findUserByGoogleSub: typeof pgWeb.findUserByGoogleSub = pick(pgWeb.findUserByGoogleSub, mem.findUserByGoogleSub);
export const findUserById: typeof pgWeb.findUserById = pick(pgWeb.findUserById, mem.findUserById);
export const createUser: typeof pgWeb.createUser = pick(pgWeb.createUser, mem.createUser);
export const linkGoogleToUser: typeof pgWeb.linkGoogleToUser = pick(pgWeb.linkGoogleToUser, mem.linkGoogleToUser);
export const updateUserPlan: typeof pgWeb.updateUserPlan = pick(pgWeb.updateUserPlan, mem.updateUserPlan);
export const addExtraSpace: typeof pgWeb.addExtraSpace = pick(pgWeb.addExtraSpace, mem.addExtraSpace);

/* -------------------------------- sesiones ------------------------------- */
export const createSession: typeof pgWeb.createSession = pick(pgWeb.createSession, mem.createSession);
export const getSessionUser: typeof pgWeb.getSessionUser = pick(pgWeb.getSessionUser, mem.getSessionUser);
export const deleteSession: typeof pgWeb.deleteSession = pick(pgWeb.deleteSession, mem.deleteSession);
export const purgeExpiredSessions: typeof pgWeb.purgeExpiredSessions = pick(pgWeb.purgeExpiredSessions, mem.purgeExpiredSessions);

/* --------------------------------- tokens -------------------------------- */
export const createTokens: typeof pgWeb.createTokens = pick(pgWeb.createTokens, mem.createTokens);
export const getTokenByCode: typeof pgWeb.getTokenByCode = pick(pgWeb.getTokenByCode, mem.getTokenByCode);
export const redeemToken: typeof pgWeb.redeemToken = pick(pgWeb.redeemToken, mem.redeemToken);
export const listTokensByOwner: typeof pgWeb.listTokensByOwner = pick(pgWeb.listTokensByOwner, mem.listTokensByOwner);
export const countUnusedTokens: typeof pgWeb.countUnusedTokens = pick(pgWeb.countUnusedTokens, mem.countUnusedTokens);

/* -------------------------------- sub-bots ------------------------------- */
export const createSubBot: typeof pgWeb.createSubBot = pick(pgWeb.createSubBot, mem.createSubBot);
export const listSubBots: typeof pgWeb.listSubBots = pick(pgWeb.listSubBots, mem.listSubBots);
export const getSubBot: typeof pgWeb.getSubBot = pick(pgWeb.getSubBot, mem.getSubBot);
export const updateSubBot: typeof pgWeb.updateSubBot = pick(pgWeb.updateSubBot, mem.updateSubBot);
export const updateSubBotOptions: typeof pgWeb.updateSubBotOptions = pick(pgWeb.updateSubBotOptions, mem.updateSubBotOptions);
export const deleteSubBot: typeof pgWeb.deleteSubBot = pick(pgWeb.deleteSubBot, mem.deleteSubBot);
export const countSubBots: typeof pgWeb.countSubBots = pick(pgWeb.countSubBots, mem.countSubBots);
export const allocatedExtraGb: typeof pgWeb.allocatedExtraGb = pick(pgWeb.allocatedExtraGb, mem.allocatedExtraGb);
export const setSubBotPairing: typeof pgWeb.setSubBotPairing = pick(pgWeb.setSubBotPairing, mem.setSubBotPairing);
export const markSubBotLinked: typeof pgWeb.markSubBotLinked = pick(pgWeb.markSubBotLinked, mem.markSubBotLinked);
export const bumpSubBotUptime: typeof pgWeb.bumpSubBotUptime = pick(pgWeb.bumpSubBotUptime, mem.bumpSubBotUptime);

/* -------------------------------- compras -------------------------------- */
export const recordPurchase: typeof pgWeb.recordPurchase = pick(pgWeb.recordPurchase, mem.recordPurchase);
export const listPurchases: typeof pgWeb.listPurchases = pick(pgWeb.listPurchases, mem.listPurchases);

/* -------------------------------- economía ------------------------------- */
export const addCoins: typeof pgPlatform.addCoins = pick(pgPlatform.addCoins, mem.addCoins);
export const getCoins: typeof pgPlatform.getCoins = pick(pgPlatform.getCoins, mem.getCoins);
export const listLedger: typeof pgPlatform.listLedger = pick(pgPlatform.listLedger, mem.listLedger);
export const lastDailyClaim: typeof pgPlatform.lastDailyClaim = pick(pgPlatform.lastDailyClaim, mem.lastDailyClaim);
export const listMissionClaims: typeof pgPlatform.listMissionClaims = pick(pgPlatform.listMissionClaims, mem.listMissionClaims);
export const claimMission: typeof pgPlatform.claimMission = pick(pgPlatform.claimMission, mem.claimMission);

/* --------------------------- catálogo de bots ---------------------------- */
export const listCatalogItems: typeof pgPlatform.listCatalogItems = pick(pgPlatform.listCatalogItems, mem.listCatalogItems);
export const listCatalogUses: typeof pgPlatform.listCatalogUses = pick(pgPlatform.listCatalogUses, mem.listCatalogUses);
export const createCatalogUse: typeof pgPlatform.createCatalogUse = pick(pgPlatform.createCatalogUse, mem.createCatalogUse);
export const countCatalogUses: typeof pgPlatform.countCatalogUses = pick(pgPlatform.countCatalogUses, mem.countCatalogUses);

/* --------------------------- tienda de monedas --------------------------- */
export const listCoinItems: typeof pgPlatform.listCoinItems = pick(pgPlatform.listCoinItems, mem.listCoinItems);
export const getCoinItem: typeof pgPlatform.getCoinItem = pick(pgPlatform.getCoinItem, mem.getCoinItem);

/* ------------------------------- servidores ------------------------------ */
export const listServers: typeof pgPlatform.listServers = pick(pgPlatform.listServers, mem.listServers);
export const getServer: typeof pgPlatform.getServer = pick(pgPlatform.getServer, mem.getServer);

/* --------------------------------- grupos -------------------------------- */
export const listSubBotGroups: typeof pgPlatform.listSubBotGroups = pick(pgPlatform.listSubBotGroups, mem.listSubBotGroups);
export const upsertSubBotGroup: typeof pgPlatform.upsertSubBotGroup = pick(pgPlatform.upsertSubBotGroup, mem.upsertSubBotGroup);
export const deleteSubBotGroup: typeof pgPlatform.deleteSubBotGroup = pick(pgPlatform.deleteSubBotGroup, mem.deleteSubBotGroup);

/* -------------------------------- reportes ------------------------------- */
export const createReport: typeof pgPlatform.createReport = pick(pgPlatform.createReport, mem.createReport);
export const listReports: typeof pgPlatform.listReports = pick(pgPlatform.listReports, mem.listReports);

/* --------------------------- totales públicos --------------------------- */
export const getPlatformCounts: typeof pgPlatform.getPlatformCounts = pick(pgPlatform.getPlatformCounts, mem.getPlatformCounts);

/* ------------------------------ ajustes/métricas ------------------------- */
export const getSetting: typeof pgCore.getSetting = pick(pgCore.getSetting, mem.getSetting);
export const setSetting: typeof pgCore.setSetting = pick(pgCore.setSetting, mem.setSetting);
export const getPlatformMetrics: typeof pgCore.getPlatformMetrics = pick(pgCore.getPlatformMetrics, mem.getPlatformMetrics);
export const auditLog: typeof pgCore.audit = pick(pgCore.audit, mem.audit);

export const usingMemory = memoryMode;

/* --------------------- alta de sub-bot con token (atómica) --------------------- */

export interface CreateSubBotInput {
  userId: number;
  name: string;
  tier: pgWeb.SubBotTier;
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
}

/** Crea el sub-bot y canjea su token en una sola transacción. */
export async function createSubBotWithToken(input: CreateSubBotInput): Promise<pgWeb.SubBotRow> {
  if (!input.tokenCode) return createSubBot(input);
  if (memoryMode) {
    const bot = await mem.createSubBot(input);
    await mem.redeemToken(input.tokenCode, input.userId, bot.id);
    return bot;
  }
  const { tx } = await import('./db.js');
  return tx(async (client) => {
    const bot = await pgWeb.createSubBot(input, client);
    const redeemed = await pgWeb.redeemToken(input.tokenCode!, input.userId, bot.id, client);
    if (!redeemed) throw new Error('El token acaba de canjearse en otra sesión.');
    return bot;
  });
}
