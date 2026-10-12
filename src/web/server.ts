import express, { type NextFunction, type Request, type Response } from 'express';
import { statfs } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import type { Server as HttpServer } from 'node:http';
import { arch, cpus, hostname, loadavg, platform, release, totalmem, freemem, uptime as osUptime } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from '../config/index.js';
import { conn, currentPairing, getSocket, logoutBot, requestPairing } from '../core/connection.js';
import { getCommandSettings, saveCommandSettings } from '../core/command-settings.js';
import { allCommands } from '../core/router.js';
import { getCommandInventory, knownCommandNames } from '../commands/catalog.js';
import { memoryMode, pool } from '../database/db.js';
import {
  addCoins,
  addExtraSpace,
  allocatedExtraGb,
  auditLog,
  bumpSubBotUptime,
  countCatalogUses,
  countSubBots,
  countUnusedTokens,
  createCatalogUse,
  createReport,
  createSubBot,
  createSubBotWithToken,
  createTokens,
  claimMission,
  deleteSubBot,
  findUserByEmail,
  getCoinItem,
  getCoins,
  getPlatformCounts,
  getPlatformMetrics,
  getServer,
  getSetting,
  getSubBot,
  getTokenByCode,
  lastDailyClaim,
  listCatalogItems,
  listCatalogUses,
  listCoinItems,
  listLedger,
  listMissionClaims,
  listPurchases,
  listReports,
  listServers,
  listSubBotGroups,
  listSubBots,
  listTokensByOwner,
  markSubBotLinked,
  recordPurchase,
  setSetting,
  setSubBotPairing,
  updateSubBotOptions,
  updateUserPlan,
  upsertSubBotGroup,
  type SubBotRow,
  type WebPlan,
} from '../database/store.js';
import { logBus, logger, recentLogs, type LogEntry } from '../utils/logger.js';
import { hit } from '../utils/ratelimit.js';
import { maskPhone } from '../utils/text.js';
import { buildMenu, DEFAULT_BANNER_TEXT, type Banner } from '../commands/general/menu.js';
import {
  attachUser,
  authLogin,
  authLogout,
  authMe,
  authRegister,
  BOT_TIERS,
  PLANS,
  googleCallback,
  googleStart,
  hasSession,
  limitAuth,
  requireUser,
  STORE_ITEMS,
  toSafeUser,
} from './auth.js';
import {
  COIN,
  INSTANCE_TYPES,
  MISSIONS,
  PREFIX_CHOICES,
  catalogBotBySlug,
} from './platform-data.js';

const here = dirname(fileURLToPath(import.meta.url));
const startedAt = new Date();
const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

function publicWriteLimit(scope: string, max = 30, windowMs = 60_000) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    if (!hit(`public-web:${scope}:${ip}`, max, windowMs)) {
      res.status(429).json({ error: 'Demasiadas acciones seguidas. Espera un momento.' });
      return;
    }
    next();
  };
}

const limitWrites = publicWriteLimit('writes', 60, 60_000);
const limitPairing = publicWriteLimit('pairing', 6, 60_000);
const limitCheckout = publicWriteLimit('checkout', 20, 60_000);

/* ------------------------------ tienda/sub-bots --------------------------- */
const TOKEN_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sin I, O, 0, 1 para leerlos mejor

function tokenBlock(): string {
  const bytes = randomBytes(4);
  return [...bytes].map((byte) => TOKEN_ALPHABET[byte % TOKEN_ALPHABET.length]).join('');
}

/** Código tipo VRSOV-PREM-7K2M-9QX4 para tokens de la tienda. */
function generateTokenCode(tier: 'premium' | 'vip'): string {
  const prefix = tier === 'vip' ? 'VIP' : 'PREM';
  return `VRSOV-${prefix}-${tokenBlock()}-${tokenBlock()}`;
}

/** Código de vinculación de WhatsApp (8 caracteres) con el formato ABCD-1234 para mostrarlo. */
function formatPairingCode(raw: string): string {
  const clean = raw.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  return clean.length === 8 ? `${clean.slice(0, 4)}-${clean.slice(4)}` : clean;
}

const AVAILABLE_BOT_TYPES = [
  { id: 'versova', name: 'VÉRSOVA', description: 'Bot de rol estándar con menú, registro, personajes, advertencias y todos los comandos VÉRSOVA.', recommended: true },
];

function withSpace(bot: SubBotRow, plan: WebPlan): SubBotRow & { baseSpaceGb: number; totalSpaceGb: number } {
  const baseSpaceGb = Math.max(BOT_TIERS[bot.tier].spaceGb, PLANS[plan].spacePerBotGb);
  return { ...bot, baseSpaceGb, totalSpaceGb: baseSpaceGb + bot.extra_gb };
}

function str(value: unknown, max = 200): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function cleanPhone(value: unknown): string {
  return typeof value === 'string' ? value.replace(/[^\d+]/g, '').slice(0, 20) : '';
}

function cleanUrl(value: unknown, max = 300): string {
  const raw = str(value, max);
  return /^https?:\/\//i.test(raw) ? raw : '';
}

function cleanPrefixes(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  const allowed = new Set<string>(PREFIX_CHOICES);
  const list = [...new Set(value.map((item) => String(item).slice(0, 2)))].filter((item) => allowed.has(item));
  return list.slice(0, 8);
}

/** Estado del saldo y las misiones del usuario, tal como lo ve la web. */
async function economyFor(userId: number, botCount: number, uses: number, purchases: number) {
  const [coins, ledger, items, claimed, daily] = await Promise.all([
    getCoins(userId),
    listLedger(userId, 40),
    listCoinItems(),
    listMissionClaims(userId),
    lastDailyClaim(userId),
  ]);
  const dailyAvailable = !daily || Date.now() - new Date(daily).getTime() >= 24 * 60 * 60 * 1000;
  const progress: Record<string, boolean> = {
    daily: dailyAvailable,
    profile: false,
    'first-bot': botCount > 0,
    'first-catalog': uses > 0,
    'first-purchase': purchases > 0,
    'three-bots': botCount >= 3,
  };
  return {
    coin: COIN,
    coins,
    ledger,
    items,
    daily: {
      available: dailyAvailable,
      lastClaimAt: daily ? new Date(daily).toISOString() : null,
      nextAt: daily ? new Date(new Date(daily).getTime() + 24 * 60 * 60 * 1000).toISOString() : null,
      reward: MISSIONS.find((mission) => mission.id === 'daily')?.reward ?? 25,
    },
    missions: MISSIONS.map((mission) => ({
      ...mission,
      claimed: claimed.includes(mission.id),
      ready: Boolean(progress[mission.id]) && !claimed.includes(mission.id),
      available: mission.id === 'daily' ? true : Boolean(progress[mission.id]),
    })),
  };
}

export function startWeb(): HttpServer {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(express.json({ limit: '4mb' }));
  const publicDir = join(here, 'public');
  // Sin «extensions»: /registrar y /store deben pasar por sus rutas con control de sesión.
  app.use(express.static(publicDir, { index: 'index.html' }));
  app.use(attachUser);

  // --------------------------------- páginas ---------------------------------
  const page = (file: string, needsSession = false, next = '') =>
    (req: Request, res: Response): void => {
      if (needsSession && !hasSession(req)) {
        res.redirect(302, `/?login=1${next ? `&next=${next}` : ''}`);
        return;
      }
      res.sendFile(join(publicDir, file));
    };

  app.get('/', page('index.html'));
  app.get('/registrar', page('registrar.html', true, 'registrar'));
  app.get('/bots', page('bots.html', true, 'bots'));
  app.get('/metrics', page('metrics.html', true, 'metrics'));
  app.get('/store', page('store.html', true, 'store'));
  app.get('/catalog', page('store.html', true, 'store'));
  app.get('/cmds', page('cmds.html'));
  app.get('/links', page('links.html'));
  app.get('/menu', page('menu.html'));
  app.get('/ticket', page('ticket.html', true, 'ticket'));
  // Ruta histórica del panel: ahora la portada hace de panel.
  app.get('/home', (_req, res) => res.redirect(302, '/'));
  app.get('/status', (_req, res) => res.redirect(302, '/metrics'));

  // --------------------------------- cuenta ---------------------------------
  app.get('/api/auth/me', (req, res) => void authMe(req, res));
  app.post('/api/auth/register', limitAuth, (req, res) => void authRegister(req, res));
  app.post('/api/auth/login', limitAuth, (req, res) => void authLogin(req, res));
  app.post('/api/auth/logout', limitAuth, (req, res) => void authLogout(req, res));
  app.get('/api/auth/google/start', googleStart);
  app.get('/api/auth/google/callback', googleCallback);

  // -------------------------------- plataforma -------------------------------
  // Datos públicos que alimentan la portada, el monitor y el asistente.
  app.get('/api/platform', async (req, res) => {
    const counts = await getPlatformCounts().catch(() => ({
      totalBots: 0, main: 0, premium: 0, subs: 0, users: 0, tokens: 0, catalogUses: 0, online: 0,
    }));
    const catalog = await listCatalogItems().catch(() => []);
    const servers = await listServers().catch(() => []);
    const bots = await Promise.all(
      catalog.map(async (bot) => ({ slug: bot.slug, uses: await countCatalogUses(bot.slug).catch(() => 0) })),
    );
    res.json({
      bot: config.bot.name,
      team: config.bot.team,
      version: config.bot.version,
      prefix: config.bot.prefix,
      memoryMode,
      uptimeSec: Math.floor((Date.now() - startedAt.getTime()) / 1000),
      commands: getCommandInventory().length,
      implemented: getCommandInventory().filter((command) => command.implemented).length,
      counts: {
        ...counts,
        commands: getCommandInventory().length,
        implemented: getCommandInventory().filter((command) => command.implemented).length,
        catalogBots: catalog.length,
        servers: servers.length,
      },
      catalogUses: Object.fromEntries(bots.map((bot) => [bot.slug, bot.uses])),
      servers,
      plans: PLANS,
      tiers: BOT_TIERS,
      instances: INSTANCE_TYPES,
      googleEnabled: Boolean(process.env.GOOGLE_CLIENT_ID?.trim() && process.env.GOOGLE_CLIENT_SECRET?.trim()),
    });
  });

  // ------------------------ catálogo de bots (gratis/pago) -------------------
  app.get('/api/catalog', async (req, res) => {
    const catalog = await listCatalogItems();
    const user = req.webUser;
    const uses = user ? await listCatalogUses(user.id) : [];
    const counts = await Promise.all(catalog.map((bot) => countCatalogUses(bot.slug).catch(() => 0)));
    res.json({
      bots: catalog.map((bot, index) => ({
        ...bot,
        priceUsd: Number(bot.price_usd),
        users: counts[index],
        owned: uses.some((use) => use.bot_slug === bot.slug),
        subbotId: uses.find((use) => use.bot_slug === bot.slug)?.subbot_id ?? null,
      })),
      categories: [...new Set(catalog.map((bot) => bot.category))],
      owned: uses.map((use) => ({ slug: use.bot_slug, subbotId: use.subbot_id, paidCoins: use.paid_coins })),
    });
  });

  // Activar un bot del catálogo: gratis, con monedas o canjeando un token.
  app.post('/api/catalog/:slug/use', limitWrites, requireUser, async (req, res) => {
    const user = req.webUser!;
    const slug = String(req.params.slug);
    const bot = catalogBotBySlug(slug);
    if (!bot) return void res.status(404).json({ error: 'Ese bot no está en el catálogo.' });

    const uses = await listCatalogUses(user.id);
    if (uses.some((use) => use.bot_slug === slug)) {
      return void res.status(409).json({ error: `Ya tienes «${bot.name}» activo en tu cuenta.` });
    }

    const wantsCoins = bot.pricing === 'coins' || bot.pricing === 'usd';
    if (wantsCoins) {
      const coins = await getCoins(user.id);
      if (coins < bot.priceCoins) {
        return void res.status(402).json({
          error: `«${bot.name}» cuesta ${bot.priceCoins} ${COIN.name} y tienes ${coins}. Compra monedas o gana con las misiones.`,
          priceCoins: bot.priceCoins,
          coins,
          shortfall: bot.priceCoins - coins,
        });
      }
    }

    if (wantsCoins) {
      const charged = await addCoins(user.id, -bot.priceCoins, 'catalog', `Activación de ${bot.name}`, { slug });
      if (!charged.ok) return void res.status(402).json({ error: 'Saldo insuficiente para activar ese bot.' });
    }

    const use = await createCatalogUse({ userId: user.id, slug, subbotId: null, paidCoins: wantsCoins ? bot.priceCoins : 0 });
    logger.info('catalogo', `${user.email} activó «${bot.name}» (${bot.pricing}${wantsCoins ? ` · ${bot.priceCoins} V-Coin` : ''}).`);
    res.status(201).json({
      ok: true,
      use: { slug, subbotId: use.subbot_id, paidCoins: use.paid_coins },
      coins: await getCoins(user.id),
      message: wantsCoins
        ? `«${bot.name}» activado. Se descontaron ${bot.priceCoins} ${COIN.name}.`
        : `«${bot.name}» activado gratis en tu cuenta.`,
    });
  });

  // --------------------------------- economía --------------------------------
  app.get('/api/economy', requireUser, async (req, res) => {
    const user = req.webUser!;
    const [bots, uses, purchases] = await Promise.all([
      countSubBots(user.id),
      listCatalogUses(user.id),
      listPurchases(user.id, 5),
    ]);
    res.json({
      ...(await economyFor(user.id, bots, uses.length, purchases.length)),
      purchases,
    });
  });

  app.post('/api/economy/daily', limitWrites, requireUser, async (req, res) => {
    const user = req.webUser!;
    const daily = await lastDailyClaim(user.id);
    if (daily && Date.now() - new Date(daily).getTime() < 24 * 60 * 60 * 1000) {
      const next = new Date(new Date(daily).getTime() + 24 * 60 * 60 * 1000);
      return void res.status(429).json({ error: 'Ya reclamaste el bono diario. Vuelve más tarde.', nextAt: next.toISOString() });
    }
    const reward = MISSIONS.find((mission) => mission.id === 'daily')?.reward ?? 25;
    const result = await addCoins(user.id, reward, 'daily', 'Bono diario', {});
    logger.info('economia', `${user.email} reclamó el bono diario (+${reward}).`);
    res.json({ ok: true, reward, coins: result.coins });
  });

  app.post('/api/economy/mission', limitWrites, requireUser, async (req, res) => {
    const user = req.webUser!;
    const missionId = str(req.body?.missionId, 40);
    const mission = MISSIONS.find((entry) => entry.id === missionId);
    if (!mission) return void res.status(404).json({ error: 'Esa misión no existe.' });
    if (missionId === 'daily') return void res.status(400).json({ error: 'El bono diario se reclama en su propio botón.' });

    const [bots, uses, purchases] = await Promise.all([
      countSubBots(user.id),
      listCatalogUses(user.id),
      listPurchases(user.id, 5),
    ]);
    const ready =
      (missionId === 'first-bot' && bots > 0) ||
      (missionId === 'first-catalog' && uses.length > 0) ||
      (missionId === 'first-purchase' && purchases.length > 0) ||
      (missionId === 'three-bots' && bots >= 3);
    if (!ready) return void res.status(400).json({ error: 'Todavía no completaste esa misión.' });

    const first = await claimMission(user.id, missionId, mission.reward);
    if (!first) return void res.status(409).json({ error: 'Ya reclamaste esta misión.' });
    const result = await addCoins(user.id, mission.reward, 'mission', `Misión: ${mission.name}`, { missionId });
    res.json({ ok: true, reward: mission.reward, coins: result.coins });
  });

  app.post('/api/economy/buy', limitCheckout, requireUser, async (req, res) => {
    const user = req.webUser!;
    const itemId = str(req.body?.itemId, 60);
    const item = await getCoinItem(itemId);
    if (!item) return void res.status(404).json({ error: 'Ese producto no existe en la tienda de monedas.' });

    const charge = await addCoins(user.id, -item.price_coins, 'shop', `Compra: ${item.name}`, { itemId });
    if (!charge.ok) {
      return void res.status(402).json({
        error: `Necesitas ${item.price_coins} ${COIN.name} y tienes ${charge.coins}.`,
      });
    }

    const payload = item.payload ?? {};
    const receipt: Record<string, unknown> = { itemId: item.id, name: item.name, priceCoins: item.price_coins };

    if (item.kind === 'space') {
      const gb = Number(payload.spaceGb ?? 1);
      await addExtraSpace(user.id, gb);
      receipt.spaceGb = gb;
      receipt.message = `Se añadieron ${gb} GB a tu pool de espacio.`;
    } else if (item.kind === 'plan') {
      const plan = String(payload.plan ?? 'premium') as WebPlan;
      await updateUserPlan(user.id, plan);
      receipt.plan = plan;
      receipt.message = `Plan ${PLANS[plan].name} activo: hasta ${PLANS[plan].maxBots} bots con ${PLANS[plan].spacePerBotGb} GB por bot.`;
    } else if (item.kind === 'token') {
      const tier = String(payload.tier ?? 'premium') as 'premium' | 'vip';
      const created = await createTokens([
        { code: generateTokenCode(tier), type: tier, spaceGb: Number(payload.spaceGb ?? 2), ownerId: user.id },
      ]);
      receipt.tokens = created.map((token) => ({ code: token.code, type: token.type, spaceGb: token.space_gb }));
      receipt.message = `Token ${tier.toUpperCase()} creado. Úsalo al registrar un bot ${tier.toUpperCase()}.`;
    } else {
      receipt.message = 'Mejora activada en tu cuenta.';
    }

    await recordPurchase({
      userId: user.id,
      itemId: item.id,
      itemName: item.name,
      quantity: 1,
      priceUsd: 0,
      details: { paidWithCoins: item.price_coins, ...receipt },
    });
    logger.info('economia', `${user.email} compró ${item.name} por ${item.price_coins} V-Coin.`);
    res.json({ ok: true, receipt, coins: await getCoins(user.id) });
  });

  // ---------------------------------- tienda ---------------------------------
  app.get('/api/store/catalog', requireUser, async (req, res) => {
    const user = req.webUser!;
    const [tokens, subBots, allocated, purchases] = await Promise.all([
      listTokensByOwner(user.id),
      countSubBots(user.id),
      allocatedExtraGb(user.id),
      listPurchases(user.id),
    ]);
    res.json({
      items: STORE_ITEMS,
      plans: PLANS,
      tiers: BOT_TIERS,
      user: toSafeUser(user),
      coins: await getCoins(user.id),
      usage: {
        botsUsed: subBots,
        botsMax: PLANS[user.plan].maxBots,
        extraSpaceGb: user.extra_space_gb,
        extraSpaceFree: Math.max(0, user.extra_space_gb - allocated),
      },
      tokens,
      purchases,
    });
  });

  app.post('/api/store/checkout', limitCheckout, requireUser, async (req, res) => {
    const user = req.webUser!;
    const itemId = typeof req.body?.itemId === 'string' ? req.body.itemId : '';
    const quantityRaw = Number(req.body?.quantity ?? 1);
    const quantity = Number.isInteger(quantityRaw) ? Math.min(10, Math.max(1, quantityRaw)) : 1;
    const item = STORE_ITEMS.find((entry) => entry.id === itemId);

    if (!item) return void res.status(404).json({ error: 'Ese producto no existe.' });
    if (!item.available) return void res.status(400).json({ error: `${item.name} todavía no está disponible.` });

    // Los planes se pueden "recomprar" para ampliar; los tokens y el espacio admiten cantidad.
    if (item.kind === 'plan' && item.plan && PLANS[item.plan].priceUsd <= PLANS[user.plan].priceUsd) {
      return void res.status(400).json({ error: `Ya tienes el plan ${PLANS[user.plan].name} o uno igual o superior.` });
    }

    const priceUsd = item.priceUsd * quantity;
    const receipt: Record<string, unknown> = { itemId: item.id, name: item.name, quantity, priceUsd };

    if (item.kind === 'plan' && item.plan) {
      await updateUserPlan(user.id, item.plan);
      receipt.plan = item.plan;
      receipt.message = `Plan ${PLANS[item.plan].name} activo: hasta ${PLANS[item.plan].maxBots} bots y ${PLANS[item.plan].spacePerBotGb} GB por bot.`;
    } else if (item.kind === 'space') {
      await addExtraSpace(user.id, item.spaceGb! * quantity);
      receipt.spaceGb = item.spaceGb! * quantity;
      receipt.message = `Se añadieron ${item.spaceGb! * quantity} GB a tu pool de espacio.`;
    } else if (item.kind === 'token') {
      const created = await createTokens(
        Array.from({ length: quantity }, () => ({
          code: generateTokenCode(item.tier!),
          type: item.tier!,
          spaceGb: item.spaceGb!,
          ownerId: user.id,
        })),
      );
      receipt.tokens = created.map((token) => ({ code: token.code, type: token.type, spaceGb: token.space_gb }));
      receipt.message =
        quantity === 1
          ? `Tu token ${item.name} está listo. Úsalo al crear un sub-bot ${item.tier!.toUpperCase()}.`
          : `${quantity} tokens ${item.name} están listos.`;
    } else if (item.kind === 'coins') {
      const coins = (item.coins ?? 0) * quantity;
      const result = await addCoins(user.id, coins, 'purchase', `Compra de ${coins} ${COIN.name}`, { itemId: item.id });
      receipt.coins = coins;
      receipt.total = result.coins;
      receipt.message = `Se acreditaron ${coins} ${COIN.name} en tu cuenta.`;
    } else if (item.kind === 'catalog') {
      const slug = item.catalogSlug!;
      const bot = catalogBotBySlug(slug);
      if (!bot) return void res.status(404).json({ error: 'Ese bot no está en el catálogo.' });
      const uses = await listCatalogUses(user.id);
      if (uses.some((use) => use.bot_slug === slug)) {
        return void res.status(409).json({ error: `Ya tienes «${bot.name}» activo.` });
      }
      await createCatalogUse({ userId: user.id, slug, subbotId: null, paidCoins: 0 });
      receipt.catalogSlug = slug;
      receipt.message = `«${bot.name}» activado en tu cuenta.`;
    } else {
      return void res.status(400).json({ error: 'Ese producto todavía no está disponible.' });
    }

    await recordPurchase({
      userId: user.id,
      itemId: item.id,
      itemName: item.name,
      quantity,
      priceUsd,
      details: item.kind === 'token'
        ? { codes: (receipt.tokens as Array<{ code: string }>).map((token) => token.code) }
        : { message: receipt.message },
    });
    logger.info('tienda', `${user.email} compró ${item.name} x${quantity} ($${priceUsd}).`);
    res.json({ ok: true, receipt });
  });

  app.get('/api/store/tokens', requireUser, async (req, res) => {
    res.json({ tokens: await listTokensByOwner(req.webUser!.id) });
  });

  // ------------------------------- servidores --------------------------------
  app.get('/api/servers', async (_req, res) => {
    const servers = await listServers();
    res.json({
      servers: servers.map((server) => ({
        ...server,
        free: Math.max(0, server.capacity - server.used),
        full: server.used >= server.capacity || server.status === 'full',
      })),
    });
  });

  // ------------------------------ sub-bots ----------------------------------
  app.get('/api/subbots', requireUser, async (req, res) => {
    const user = req.webUser!;
    const [bots, used, allocated, tokens, uses] = await Promise.all([
      listSubBots(user.id),
      countSubBots(user.id),
      allocatedExtraGb(user.id),
      listTokensByOwner(user.id),
      listCatalogUses(user.id),
    ]);
    const withGroups = await Promise.all(
      bots.map(async (bot) => ({
        ...withSpace(bot, user.plan),
        groups: await listSubBotGroups(bot.id).catch(() => []),
      })),
    );
    res.json({
      bots: withGroups,
      plan: PLANS[user.plan],
      tiers: BOT_TIERS,
      botTypes: AVAILABLE_BOT_TYPES,
      instances: INSTANCE_TYPES,
      catalog: await listCatalogItems(),
      uses,
      usage: {
        botsUsed: used,
        botsMax: PLANS[user.plan].maxBots,
        extraSpaceGb: user.extra_space_gb,
        extraSpaceFree: Math.max(0, user.extra_space_gb - allocated),
      },
      economy: await economyFor(user.id, used, uses.length, (await listPurchases(user.id, 5)).length),
      tokens: tokens.filter((token) => token.status === 'unused'),
    });
  });

  app.post('/api/subbots', limitWrites, requireUser, async (req, res) => {
    const user = req.webUser!;
    const body = req.body ?? {};
    const name = str(body.name, 40);
    const tier = typeof body.tier === 'string' ? (body.tier as keyof typeof BOT_TIERS) : 'free';
    const phone = cleanPhone(body.phone);
    const description = str(body.description, 300);
    const tokenCode = str(body.tokenCode, 40).toUpperCase();
    const botType = str(body.botType, 30) || 'versova';
    const catalogSlug = str(body.catalogSlug, 40) || botType;
    const serverId = str(body.serverId, 40) || 'vrsov-01';
    const server = await getServer(serverId);

    if (name.length < 2 || name.length > 40) {
      return void res.status(400).json({ error: 'El nombre del bot necesita entre 2 y 40 caracteres.' });
    }
    if (!BOT_TIERS[tier]) return void res.status(400).json({ error: 'Tipo de bot inválido.' });
    if (!AVAILABLE_BOT_TYPES.some((entry) => entry.id === botType)) {
      return void res.status(400).json({ error: 'Tipo de bot no válido.' });
    }
    if (!server) return void res.status(400).json({ error: 'Ese servidor no existe.' });
    if (server.status === 'maintenance') return void res.status(400).json({ error: `${server.name} está en mantenimiento.` });
    if (server.used >= server.capacity) return void res.status(400).json({ error: `${server.name} está lleno. Elige otro servidor.` });

    const planInfo = PLANS[user.plan];
    const used = await countSubBots(user.id);
    if (used >= planInfo.maxBots) {
      return void res.status(403).json({
        error: `Tu plan ${planInfo.name} permite hasta ${planInfo.maxBots} bots. Mejora de plan en la tienda para crear más.`,
      });
    }

    const instance = INSTANCE_TYPES.find((entry) => entry.id === str(body.instanceType, 20)) ?? INSTANCE_TYPES[0];
    const needsToken = BOT_TIERS[tier].requiresToken;
    let token = null as Awaited<ReturnType<typeof getTokenByCode>>;
    if (needsToken) {
      if (!tokenCode) {
        return void res.status(400).json({ error: `Para una instancia ${BOT_TIERS[tier].name} necesitas el código de un token.` });
      }
      token = await getTokenByCode(tokenCode);
      if (!token || token.status !== 'unused' || token.type !== tier) {
        return void res.status(400).json({ error: 'Ese token no es válido (revisa el código, que no esté usado y que sea del mismo tipo).' });
      }
      if (token.owner_id !== user.id) {
        return void res.status(403).json({ error: 'Ese token no pertenece a tu cuenta.' });
      }
    }

    const prefixes = cleanPrefixes(body.prefixes) ?? ['.'];
    const options = {
      userId: user.id,
      name,
      tier,
      tokenCode: needsToken ? tokenCode : null,
      phone,
      description,
      botType,
      displayName: str(body.displayName, 40) || str(body.shortName, 40) || name,
      botPrefix: prefixes[0] ?? '.',
      bannerText: str(body.bannerText, 800),
      shortName: str(body.shortName, 30) || name,
      longName: str(body.longName, 60) || name,
      currency: str(body.currency, 30),
      ownerNumber: cleanPhone(body.ownerNumber),
      ownerHidden: body.ownerHidden !== false,
      botLink: cleanUrl(body.botLink) || `https://${req.get('host') ?? 'web.versova.app'}/cmds`,
      channelUrl: cleanUrl(body.channelUrl),
      prefixes,
      bannerUrl: cleanUrl(body.bannerUrl, 400),
      username: str(body.username, 40) || name.toLowerCase().replace(/\s+/g, ''),
      statusInfo: str(body.statusInfo, 40) || 'online',
      instanceType: instance.id,
      serverId: server.id,
      serverName: server.name,
      avatarUrl: cleanUrl(body.avatarUrl, 400),
      catalogSlug,
    };

    const bot = await createSubBotWithToken(options);
    await upsertSubBotGroup(bot.id, {
      jid: `pending-${bot.id}@g.us`,
      name: 'Sin grupos todavía',
      members: 0,
      active: false,
    }).catch(() => undefined);
    logger.info('subbots', `${user.email} creó «${name}» (${tier}, ${server.name}${token ? `, token ${token.code}` : ''}).`);
    res.status(201).json({ bot: withSpace(bot, user.plan) });
  });

  // «Opciones del bot»: nombre corto/largo, moneda, owner, enlaces, prefijos…
  app.put('/api/subbots/:id/options', limitWrites, requireUser, async (req, res) => {
    const user = req.webUser!;
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return void res.status(400).json({ error: 'Bot inválido.' });
    const bot = await getSubBot(id, user.id);
    if (!bot) return void res.status(404).json({ error: 'Ese bot no existe o no es tuyo.' });

    const body = req.body ?? {};
    const patch: Parameters<typeof updateSubBotOptions>[2] = {};

    if (typeof body.shortName === 'string') patch.shortName = str(body.shortName, 30);
    if (typeof body.longName === 'string') patch.longName = str(body.longName, 60);
    if (typeof body.currency === 'string') patch.currency = str(body.currency, 30);
    if (typeof body.ownerNumber === 'string') patch.ownerNumber = cleanPhone(body.ownerNumber);
    if (typeof body.ownerHidden === 'boolean') patch.ownerHidden = body.ownerHidden;
    if (typeof body.botLink === 'string') patch.botLink = cleanUrl(body.botLink);
    if (typeof body.channelUrl === 'string') patch.channelUrl = cleanUrl(body.channelUrl);
    if (typeof body.bannerUrl === 'string') patch.bannerUrl = cleanUrl(body.bannerUrl, 400);
    if (typeof body.username === 'string') patch.username = str(body.username, 40);
    if (typeof body.statusInfo === 'string') patch.statusInfo = str(body.statusInfo, 40);
    if (typeof body.description === 'string') patch.description = str(body.description, 300);
    if (typeof body.name === 'string') {
      const name = str(body.name, 40);
      if (name.length < 2) return void res.status(400).json({ error: 'El nombre necesita al menos 2 caracteres.' });
      patch.name = name;
    }
    if (body.prefixes !== undefined) {
      const prefixes = cleanPrefixes(body.prefixes);
      if (!prefixes) return void res.status(400).json({ error: 'Los prefijos no son válidos.' });
      patch.prefixes = prefixes;
      patch.botPrefix = prefixes[0] ?? '.';
    }
    if (typeof body.phone === 'string') patch.phone = cleanPhone(body.phone);
    if (typeof body.avatarUrl === 'string') patch.avatarUrl = cleanUrl(body.avatarUrl, 400);
    if (typeof body.catalogSlug === 'string' && body.catalogSlug) {
      const catalogBot = catalogBotBySlug(str(body.catalogSlug, 40));
      if (catalogBot) patch.catalogSlug = catalogBot.slug;
    }
    if (typeof body.instanceType === 'string') {
      const instance = INSTANCE_TYPES.find((entry) => entry.id === str(body.instanceType, 20));
      if (!instance) return void res.status(400).json({ error: 'Esa instancia no existe.' });
      patch.instanceType = instance.id;
    }
    if (typeof body.serverId === 'string') {
      const server = await getServer(str(body.serverId, 40));
      if (!server) return void res.status(400).json({ error: 'Ese servidor no existe.' });
      patch.serverId = server.id;
      patch.serverName = server.name;
    }
    if (typeof body.status === 'string' && ['online', 'offline', 'paused'].includes(body.status)) {
      patch.status = body.status as SubBotRow['status'];
    }
    if (body.extraGb !== undefined) {
      const extraGb = Number(body.extraGb);
      if (!Number.isInteger(extraGb) || extraGb < 0 || extraGb > 1024) {
        return void res.status(400).json({ error: 'Espacio extra inválido.' });
      }
      const allocatedOthers = await allocatedExtraGb(user.id, id);
      if (extraGb + allocatedOthers > user.extra_space_gb) {
        const free = Math.max(0, user.extra_space_gb - allocatedOthers);
        return void res.status(400).json({ error: `Solo tienes ${free} GB sin asignar. Cómpralos en la tienda.` });
      }
      patch.extraGb = extraGb;
    }

    const updated = await updateSubBotOptions(id, user.id, patch);
    if (!updated) return void res.status(404).json({ error: 'Ese bot no existe o no es tuyo.' });
    logger.info('subbots', `${user.email} guardó las opciones de «${updated.name}».`);
    res.json({ bot: withSpace(updated, user.plan) });
  });

  // Compatibilidad con la edición clásica (panel anterior).
  app.put('/api/subbots/:id', limitWrites, requireUser, async (req, res, next) => {
    req.url = `${req.url}/options`;
    next();
  });

  app.post('/api/subbots/:id/action', limitWrites, requireUser, async (req, res) => {
    const user = req.webUser!;
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return void res.status(400).json({ error: 'Bot inválido.' });
    const bot = await getSubBot(id, user.id);
    if (!bot) return void res.status(404).json({ error: 'Ese bot no existe o no es tuyo.' });
    const action = str(req.body?.action, 20);

    switch (action) {
      case 'restart': {
        const updated = await updateSubBotOptions(id, user.id, { status: 'online', statusInfo: 'reiniciando' });
        if (updated) await bumpSubBotUptime(id, 0);
        logger.info('subbots', `${user.email} reinició «${bot.name}».`);
        return void res.json({ ok: true, bot: updated ? withSpace(updated, user.plan) : null, message: 'Bot reiniciado.' });
      }
      case 'stop': {
        const updated = await updateSubBotOptions(id, user.id, { status: 'offline', statusInfo: 'apagado' });
        return void res.json({ ok: true, bot: updated ? withSpace(updated, user.plan) : null, message: 'Bot apagado.' });
      }
      case 'start': {
        const updated = await updateSubBotOptions(id, user.id, { status: 'online', statusInfo: 'online' });
        return void res.json({ ok: true, bot: updated ? withSpace(updated, user.plan) : null, message: 'Bot encendido.' });
      }
      case 'pause': {
        const updated = await updateSubBotOptions(id, user.id, { status: 'paused', statusInfo: 'en pausa' });
        return void res.json({ ok: true, bot: updated ? withSpace(updated, user.plan) : null, message: 'Bot en pausa.' });
      }
      case 'server': {
        const serverList = await listServers();
        return void res.json({ ok: true, servers: serverList, current: bot.server_id });
      }
      case 'unlink':
      case 'delete': {
        await deleteSubBot(id, user.id);
        logger.info('subbots', `${user.email} eliminó «${bot.name}».`);
        return void res.json({
          ok: true,
          note: bot.token_code ? 'El token usado por este bot queda consumido.' : null,
        });
      }
      default:
        return void res.status(400).json({ error: 'Acción no reconocida.' });
    }
  });

  app.delete('/api/subbots/:id', limitWrites, requireUser, async (req, res) => {
    const user = req.webUser!;
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return void res.status(400).json({ error: 'Bot inválido.' });
    const bot = await getSubBot(id, user.id);
    if (!bot) return void res.status(404).json({ error: 'Ese bot no existe o no es tuyo.' });
    await deleteSubBot(id, user.id);
    logger.info('subbots', `${user.email} eliminó «${bot.name}».`);
    res.json({ ok: true, note: bot.token_code ? 'El token usado por este bot queda consumido.' : null });
  });

  app.get('/api/subbots/:id/groups', requireUser, async (req, res) => {
    const user = req.webUser!;
    const id = Number(req.params.id);
    const bot = await getSubBot(id, user.id);
    if (!bot) return void res.status(404).json({ error: 'Ese bot no existe o no es tuyo.' });
    res.json({ groups: (await listSubBotGroups(id)).filter((group) => group.active) });
  });

  // Vinculación por código de 8 dígitos (paso 5 del asistente).
  app.post('/api/subbots/:id/pair', limitPairing, requireUser, async (req, res) => {
    const user = req.webUser!;
    const id = Number(req.params.id);
    const bot = await getSubBot(id, user.id);
    if (!bot) return void res.status(404).json({ error: 'Ese bot no existe o no es tuyo.' });
    const phone = cleanPhone(req.body?.phone) || bot.phone;
    if (phone.replace(/\D/g, '').length < 8) {
      return void res.status(400).json({ error: 'El número del bot necesita código de país (mínimo 8 dígitos).' });
    }
    // El código lo emite WhatsApp (mismo flujo que la consola de vinculación). Antes se generaba
    // localmente y nunca llegaba al servidor de WhatsApp, por eso el teléfono lo rechazaba.
    let raw: string;
    try {
      raw = await requestPairing(phone);
    } catch (err) {
      logger.warn('subbots', `Código de vinculación rechazado para «${bot.name}»: ${(err as Error).message}`);
      return void res.status(400).json({ error: (err as Error).message });
    }
    const code = formatPairingCode(raw);
    const expiresAt = new Date(conn.pairingExpiresAt ?? Date.now() + 60_000);
    await setSubBotPairing(id, user.id, code, expiresAt);
    res.json({ code, formatted: code, expiresAt: expiresAt.getTime(), phone, expired: false });
  });

  app.get('/api/subbots/:id/pair', requireUser, async (req, res) => {
    const user = req.webUser!;
    const id = Number(req.params.id);
    const bot = await getSubBot(id, user.id);
    if (!bot) return void res.status(404).json({ error: 'Ese bot no existe o no es tuyo.' });
    const expiresAt = bot.pairing_expires_at ? new Date(bot.pairing_expires_at).getTime() : null;
    res.json({
      code: bot.pairing_code,
      expiresAt,
      expired: Boolean(expiresAt && expiresAt < Date.now()),
      linked: bot.status === 'online' && Boolean(bot.linked_at),
      status: bot.status,
    });
  });

  /** Confirma la vinculación (en la demo basta con pulsar «Ya lo vinculé»). */
  app.post('/api/subbots/:id/pair/confirm', limitWrites, requireUser, async (req, res) => {
    const user = req.webUser!;
    const id = Number(req.params.id);
    const bot = await getSubBot(id, user.id);
    if (!bot) return void res.status(404).json({ error: 'Ese bot no existe o no es tuyo.' });
    if (bot.pairing_code && bot.pairing_expires_at && new Date(bot.pairing_expires_at).getTime() < Date.now()) {
      return void res.status(400).json({ error: 'El código expiró. Genera uno nuevo.' });
    }
    const linked = await markSubBotLinked(id, user.id);
    await upsertSubBotGroup(id, {
      jid: `${bot.phone.replace(/\D/g, '') || 'demo'}-${id}@g.us`,
      name: `${bot.name} · grupo principal`,
      members: 12,
      active: true,
    }).catch(() => undefined);
    logger.info('subbots', `${user.email} vinculó «${bot.name}» (${bot.phone}).`);
    res.json({ ok: true, bot: linked ? withSpace(linked, user.plan) : null, message: 'Bot vinculado y en línea.' });
  });

  // ------------------------------ reportes ----------------------------------
  app.get('/api/reports', requireUser, async (req, res) => {
    res.json({ reports: await listReports(req.webUser!.id) });
  });

  app.post('/api/reports', limitWrites, requireUser, async (req, res) => {
    const user = req.webUser!;
    const kind = req.body?.kind === 'suggestion' ? 'suggestion' : 'report';
    const text = str(req.body?.text, 1200);
    if (text.length < 10) return void res.status(400).json({ error: 'El texto necesita al menos 10 caracteres.' });
    const report = await createReport({
      userId: user.id,
      kind,
      username: str(req.body?.username, 60) || user.name,
      whatsapp: cleanPhone(req.body?.whatsapp) || user.email,
      text,
    });
    logger.info('reportes', `${user.email} envió ${kind === 'report' ? 'un reporte' : 'una sugerencia'}.`);
    res.status(201).json({ ok: true, report });
  });

  // ------------------------- consola de WhatsApp -------------------------
  // Salud del servicio (Render y monitores externos).
  app.get('/health', async (_req, res) => {
    let db = memoryMode ? 'memory' : 'ok';
    if (!memoryMode) {
      try {
        await pool.query('SELECT 1');
      } catch {
        db = 'error';
      }
    }
    res.status(db === 'error' ? 503 : 200).json({ ok: db !== 'error', db, whatsapp: conn.status });
  });

  // Esta consola es pública: no solicita clave ni sesión de administrador.
  app.get('/api/status', async (_req, res) => {
    const pairing = currentPairing();
    res.json({
      bot: config.bot.name,
      team: config.bot.team,
      version: config.bot.version,
      prefix: config.bot.prefix,
      whatsapp: conn.status,
      me: conn.me ? maskPhone(conn.me) : null,
      since: conn.since,
      lastError: conn.lastError,
      qr: conn.qrDataUrl,
      pairingCode: pairing.code,
      pairingExpiresAt: pairing.expiresAt,
      pairingReady: conn.status === 'qr',
      linked: conn.status === 'open',
      uptimeSec: Math.floor((Date.now() - startedAt.getTime()) / 1000),
      connected: Boolean(getSocket()),
    });
  });

  app.post('/api/pair', limitPairing, async (req, res) => {
    const phone = typeof req.body?.phone === 'string' ? req.body.phone : '';
    try {
      const code = await requestPairing(phone);
      res.json({ code, expiresAt: currentPairing().expiresAt });
    } catch (err) {
      logger.warn('web', `Emparejamiento rechazado: ${(err as Error).message}`);
      res.status(400).json({ error: (err as Error).message });
    }
  });

  app.post('/api/logout', limitWrites, async (_req, res) => {
    try {
      await logoutBot();
      res.json({ ok: true });
    } catch (err) {
      logger.error('web', `Logout falló: ${(err as Error).message}`);
      res.status(500).json({ error: 'No se pudo cerrar la sesión.' });
    }
  });

  // Telemetría real del servidor para la sección Monitor del panel.
  app.get('/api/system', async (_req, res) => {
    const cpuList = cpus();
    const cores = cpuList.length || 1;
    const load = loadavg();
    const totalBytes = totalmem();
    const freeBytes = freemem();
    const usedBytes = totalBytes - freeBytes;
    const round = (value: number, digits = 1) => Number(value.toFixed(digits));
    const percent = (part: number, whole: number) => (whole > 0 ? round((part / whole) * 100, 1) : 0);

    let disk: { totalGb: number; freeGb: number; usedGb: number; usedPercent: number } | null = null;
    try {
      const fs = await statfs(process.cwd());
      const total = fs.blocks * fs.bsize;
      const free = fs.bavail * fs.bsize;
      disk = {
        totalGb: round(total / 1024 ** 3),
        freeGb: round(free / 1024 ** 3),
        usedGb: round((total - free) / 1024 ** 3),
        usedPercent: percent(total - free, total),
      };
    } catch {
      disk = null;
    }

    const dbStart = Date.now();
    let dbLatencyMs: number | null = null;
    if (memoryMode) {
      dbLatencyMs = 0;
    } else {
      try {
        await pool.query('SELECT 1');
        dbLatencyMs = Date.now() - dbStart;
      } catch {
        dbLatencyMs = null;
      }
    }

    res.json({
      hostname: hostname(),
      pid: process.pid,
      platform: `${platform()} ${release()}`,
      arch: arch(),
      node: process.version,
      cpuModel: cpuList[0]?.model?.trim() ?? 'Desconocida',
      cpuCores: cores,
      cpuSpeedMhz: cpuList[0]?.speed ?? null,
      loadAvg: load.map((value) => round(value, 2)),
      cpuPercent: Math.min(100, percent(load[0] ?? 0, cores)),
      uptimeSec: Math.floor(process.uptime()),
      systemUptimeSec: Math.floor(osUptime()),
      memory: {
        totalGb: round(totalBytes / 1024 ** 3, 2),
        usedGb: round(usedBytes / 1024 ** 3, 2),
        freeGb: round(freeBytes / 1024 ** 3, 2),
        usedPercent: percent(usedBytes, totalBytes),
      },
      disk,
      dbLatencyMs,
      memoryMode,
      time: new Date().toISOString(),
    });
  });

  // Totales reales de la base (grupos, integrantes, personajes, advertencias…).
  app.get('/api/metrics', async (_req, res) => {
    try {
      res.json({ ok: true, metrics: await getPlatformMetrics(), memoryMode });
    } catch (err) {
      logger.warn('web', `Métricas no disponibles: ${(err as Error).message}`);
      res.status(503).json({ ok: false, error: 'La base de datos no está disponible ahora mismo.' });
    }
  });

  app.get('/api/banner', async (_req, res) => {
    const banner = (await getSetting<Banner>('banner')) ?? { text: '', image: null };
    res.json({
      text: banner.text,
      defaultText: DEFAULT_BANNER_TEXT,
      hasImage: Boolean(banner.image),
      imageMime: banner.image?.mime ?? null,
    });
  });

  app.get('/api/banner/image', async (_req, res) => {
    const banner = (await getSetting<Banner>('banner')) ?? { text: '', image: null };
    if (!banner.image) return void res.status(404).json({ error: 'No hay imagen de banner guardada.' });
    res.type(banner.image.mime);
    res.send(Buffer.from(banner.image.data, 'base64'));
  });

  app.put('/api/banner', limitWrites, async (req, res) => {
    const body = req.body ?? {};
    const current = (await getSetting<Banner>('banner')) ?? { text: '', image: null };
    let image = current.image;

    if (body.imageDataUrl !== undefined) {
      if (body.imageDataUrl === null || body.imageDataUrl === '') {
        image = null;
      } else if (typeof body.imageDataUrl === 'string') {
        const match = /^data:([^;]+);base64,(.+)$/.exec(body.imageDataUrl);
        if (!match) return void res.status(400).json({ error: 'La imagen no es válida.' });
        const mime = match[1];
        if (!IMAGE_TYPES.includes(mime)) {
          return void res.status(400).json({ error: 'Formato no admitido. Usa PNG, JPG o WEBP.' });
        }
        const bytes = Buffer.from(match[2], 'base64').length;
        if (bytes > config.defaults.maxBannerBytes) {
          return void res.status(413).json({ error: 'La imagen pesa demasiado (máximo 1,5 MB).' });
        }
        image = { mime, data: match[2] };
      }
    }

    const next: Banner = {
      text: typeof body.text === 'string' ? body.text.slice(0, 1200) : current.text,
      image,
    };
    await setSetting('banner', next);
    res.json({ ok: true, banner: { ...next, image: image ? { mime: image.mime } : null } });
  });

  app.delete('/api/banner/image', limitWrites, async (_req, res) => {
    const current = (await getSetting<Banner>('banner')) ?? { text: '', image: null };
    await setSetting('banner', { text: current.text, image: null });
    res.json({ ok: true });
  });

  // ------------------------- comandos y sus ajustes -------------------------
  app.get('/api/commands', async (_req, res) => {
    res.json({ settings: getCommandSettings(), commands: getCommandInventory() });
  });

  app.put('/api/commands', limitWrites, async (req, res) => {
    try {
      const activeNames = allCommands().map((command) => command.name);
      const settings = await saveCommandSettings(req.body, activeNames, knownCommandNames());
      logger.info('web', 'Se actualizaron los ajustes de comandos.');
      res.json({ ok: true, settings, commands: getCommandInventory(settings) });
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
    }
  });

  app.get('/api/menu', async (req, res) => {
    const banner = (await getSetting<Banner>('banner')) ?? { text: '', image: null };
    const body = buildMenu(banner.text);
    res.json({
      text: body,
      hasBannerImage: Boolean(banner.image),
      imageUrl: banner.image ? '/api/banner/image' : null,
    });
  });

  app.get('/api/logs/stream', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    const send = (entry: LogEntry): void => {
      res.write(`data: ${JSON.stringify(entry)}\n\n`);
    };
    for (const entry of recentLogs()) send(entry);
    logBus.on('log', send);

    const keepAlive = setInterval(() => res.write(': ping\n\n'), 20_000);
    req.on('close', () => {
      clearInterval(keepAlive);
      logBus.off('log', send);
    });
  });

  const server = app.listen(config.server.port, '0.0.0.0', () => {
    logger.info('web', `Panel disponible en http://localhost:${config.server.port}`);
  });
  return server;
}
