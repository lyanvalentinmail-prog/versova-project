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
import { getPlatformMetrics, getSetting, setSetting } from '../database/repos.js';
import { pool, tx } from '../database/db.js';
import {
  addExtraSpace,
  allocatedExtraGb,
  countSubBots,
  countUnusedTokens,
  createSubBot,
  createTokens,
  deleteSubBot,
  findUserByEmail,
  getSubBot,
  getTokenByCode,
  listPurchases,
  listSubBots,
  listTokensByOwner,
  recordPurchase,
  redeemToken,
  updateUserPlan,
  updateSubBot,
  type SubBotRow,
  type WebPlan,
} from '../database/repos-web.js';
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

const limitWrites = publicWriteLimit('writes', 30, 60_000);
const limitPairing = publicWriteLimit('pairing', 4, 60_000);
const limitCheckout = publicWriteLimit('checkout', 12, 60_000);

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

/** Espacio total de un sub-bot: el mayor entre su tipo y el plan del usuario, más el extra asignado. */
/** Tipos de bot que el usuario puede elegir al crear uno. */
const AVAILABLE_BOT_TYPES = [
  { id: 'versova', name: 'VÉRSOVA', description: 'Bot de rol estándar con menú, registro, personajes, advertencias y todos los comandos VÉRSOVA.', recommended: true },
  { id: 'musica', name: 'Música', description: 'Reproductor de música en grupos (próximamente).', comingSoon: true },
  { id: 'ia', name: 'IA', description: 'Chat con inteligencia artificial (próximamente).', comingSoon: true },
  { id: 'juegos', name: 'Juegos', description: 'Minijuegos, trivia y economía (próximamente).', comingSoon: true },
];

function withSpace(bot: SubBotRow, plan: WebPlan): SubBotRow & { baseSpaceGb: number; totalSpaceGb: number } {
  const baseSpaceGb = Math.max(BOT_TIERS[bot.tier].spaceGb, PLANS[plan].spacePerBotGb);
  return {
    ...bot,
    baseSpaceGb,
    totalSpaceGb: baseSpaceGb + bot.extra_gb,
  };
}

export function startWeb(): HttpServer {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(express.json({ limit: '3mb' }));
  const publicDir = join(here, 'public');
  // Sin «extensions»: /home y /store deben pasar por sus rutas con control de sesión.
  app.use(express.static(publicDir, { index: 'index.html' }));
  app.use(attachUser);

  // Páginas del panel (una sola app, varias rutas como en la web de referencia).
  // El panel y la tienda requieren cuenta: sin sesión se manda a la portada a iniciar sesión.
  app.get('/home', (req, res) => {
    if (!hasSession(req)) return res.redirect(302, '/?login=1');
    res.sendFile(join(publicDir, 'home.html'));
  });
  app.get('/store', (req, res) => {
    if (!hasSession(req)) return res.redirect(302, '/?login=1&next=store');
    res.sendFile(join(publicDir, 'store.html'));
  });
  app.get('/cmds', (_req, res) => res.sendFile(join(publicDir, 'cmds.html')));
  app.get('/status', (_req, res) => res.redirect(302, '/home#monitor'));

  // ------------------------------ cuenta ------------------------------
  app.get('/api/auth/me', (req, res) => void authMe(req, res));
  app.post('/api/auth/register', limitAuth, (req, res) => void authRegister(req, res));
  app.post('/api/auth/login', limitAuth, (req, res) => void authLogin(req, res));
  app.post('/api/auth/logout', limitAuth, (req, res) => void authLogout(req, res));
  app.get('/api/auth/google/start', googleStart);
  app.get('/api/auth/google/callback', googleCallback);

  // ------------------------------- tienda -------------------------------
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
    if (item.kind === 'space' && quantity < 1) return void res.status(400).json({ error: 'Cantidad inválida.' });

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
    } else {
      return void res.status(400).json({ error: 'Ese producto todavía no está disponible.' });
    }

    await recordPurchase({
      userId: user.id,
      itemId: item.id,
      itemName: item.name,
      quantity,
      priceUsd,
      details: item.kind === 'token' ? { codes: (receipt.tokens as Array<{ code: string }>).map((token) => token.code) } : {},
    });
    logger.info('tienda', `${user.email} compró ${item.name} x${quantity} ($${priceUsd}).`);
    res.json({ ok: true, receipt });
  });

  app.get('/api/store/tokens', requireUser, async (req, res) => {
    res.json({ tokens: await listTokensByOwner(req.webUser!.id) });
  });

  // ------------------------------ sub-bots ------------------------------
  app.get('/api/subbots', requireUser, async (req, res) => {
    const user = req.webUser!;
    const [bots, used, allocated, tokens] = await Promise.all([
      listSubBots(user.id),
      countSubBots(user.id),
      allocatedExtraGb(user.id),
      listTokensByOwner(user.id),
    ]);
    res.json({
      bots: bots.map((bot) => withSpace(bot, user.plan)),
      plan: PLANS[user.plan],
      tiers: BOT_TIERS,
      botTypes: AVAILABLE_BOT_TYPES,
      usage: {
        botsUsed: used,
        botsMax: PLANS[user.plan].maxBots,
        extraSpaceGb: user.extra_space_gb,
        extraSpaceFree: Math.max(0, user.extra_space_gb - allocated),
      },
      tokens: tokens.filter((token) => token.status === 'unused'),
    });
  });

  app.post('/api/subbots', limitWrites, requireUser, async (req, res) => {
    const user = req.webUser!;
    const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
    const tier = typeof req.body?.tier === 'string' ? (req.body.tier as keyof typeof BOT_TIERS) : 'free';
    const phone = typeof req.body?.phone === 'string' ? req.body.phone.replace(/[^\d+]/g, '').slice(0, 20) : '';
    const description = typeof req.body?.description === 'string' ? req.body.description.trim().slice(0, 300) : '';
    const tokenCode = typeof req.body?.tokenCode === 'string' ? req.body.tokenCode.trim().toUpperCase() : '';
    const botType = typeof req.body?.botType === 'string' ? req.body.botType.trim() : 'versova';
    const displayName = typeof req.body?.displayName === 'string' ? req.body.displayName.trim().slice(0, 40) : '';
    const botPrefix = typeof req.body?.botPrefix === 'string' ? req.body.botPrefix.trim().slice(0, 4) : '.';
    const bannerText = typeof req.body?.bannerText === 'string' ? req.body.bannerText.slice(0, 800) : '';

    if (name.length < 2 || name.length > 40) {
      return void res.status(400).json({ error: 'El nombre del sub-bot necesita entre 2 y 40 caracteres.' });
    }
    if (!BOT_TIERS[tier]) return void res.status(400).json({ error: 'Tipo de sub-bot inválido.' });
    if (!AVAILABLE_BOT_TYPES.some((bt) => bt.id === botType)) {
      return void res.status(400).json({ error: 'Tipo de bot no válido.' });
    }
    const chosenType = AVAILABLE_BOT_TYPES.find((bt) => bt.id === botType);
    if (chosenType?.comingSoon) {
      return void res.status(400).json({ error: `«${chosenType.name}» todavía no está disponible. Elige VÉRSOVA por ahora.` });
    }

    const planInfo = PLANS[user.plan];
    const used = await countSubBots(user.id);
    if (used >= planInfo.maxBots) {
      return void res.status(403).json({
        error: `Tu plan ${planInfo.name} permite hasta ${planInfo.maxBots} sub-bots. Mejora de plan en la tienda para crear más.`,
      });
    }

    if (BOT_TIERS[tier].requiresToken) {
      const token = tokenCode ? await getTokenByCode(tokenCode) : null;
      if (!tokenCode) {
        return void res.status(400).json({ error: `Para un sub-bot ${BOT_TIERS[tier].name} necesitas el código de un token.` });
      }
      if (!token || token.status !== 'unused' || token.type !== tier) {
        return void res.status(400).json({ error: 'Ese token no es válido (revisa el código, que no esté usado y que sea del mismo tipo).' });
      }
      if (token.owner_id !== user.id) {
        return void res.status(403).json({ error: 'Ese token no pertenece a tu cuenta.' });
      }

      const bot = await tx(async (client) => {
        const created = await createSubBot(
          { userId: user.id, name, tier, tokenCode: token.code, phone, description,
            botType, displayName, botPrefix, bannerText },
          client,
        );
        const redeemed = await redeemToken(token.code, user.id, created.id, client);
        if (!redeemed) throw new Error('El token acaba de canjearse en otra sesión.');
        return created;
      });
      logger.info('subbots', `${user.email} creó el sub-bot «${name}» (${tier}, ${botType}, token ${token.code}).`);
      return void res.status(201).json({ bot: withSpace(bot, user.plan) });
    }

    const bot = await createSubBot({ userId: user.id, name, tier, tokenCode: null, phone, description,
      botType, displayName, botPrefix, bannerText });
    logger.info('subbots', `${user.email} creó el sub-bot «${name}» (${tier}, ${botType}).`);
    res.status(201).json({ bot: withSpace(bot, user.plan) });
  });

  app.put('/api/subbots/:id', limitWrites, requireUser, async (req, res) => {
    const user = req.webUser!;
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return void res.status(400).json({ error: 'Sub-bot inválido.' });
    const bot = await getSubBot(id, user.id);
    if (!bot) return void res.status(404).json({ error: 'Ese sub-bot no existe o no es tuyo.' });

    const patch: {
      name?: string;
      phone?: string;
      description?: string;
      status?: SubBotRow['status'];
      extraGb?: number;
      botType?: string;
      displayName?: string;
      botPrefix?: string;
      bannerText?: string;
    } = {};
    if (typeof req.body?.name === 'string') {
      const name = req.body.name.trim();
      if (name.length < 2 || name.length > 40) return void res.status(400).json({ error: 'El nombre necesita entre 2 y 40 caracteres.' });
      patch.name = name;
    }
    if (typeof req.body?.phone === 'string') patch.phone = req.body.phone.replace(/[^\d+]/g, '').slice(0, 20);
    if (typeof req.body?.description === 'string') patch.description = req.body.description.trim().slice(0, 300);
    if (typeof req.body?.status === 'string' && ['online', 'offline', 'paused'].includes(req.body.status)) {
      patch.status = req.body.status as SubBotRow['status'];
    }
    if (typeof req.body?.botType === 'string') {
      if (!AVAILABLE_BOT_TYPES.some((bt) => bt.id === req.body.botType)) {
        return void res.status(400).json({ error: 'Tipo de bot no válido.' });
      }
      const chosenType = AVAILABLE_BOT_TYPES.find((bt) => bt.id === req.body.botType);
      if (chosenType?.comingSoon) {
        return void res.status(400).json({ error: `«${chosenType.name}» todavía no está disponible.` });
      }
      patch.botType = req.body.botType;
    }
    if (typeof req.body?.displayName === 'string') patch.displayName = req.body.displayName.trim().slice(0, 40);
    if (typeof req.body?.botPrefix === 'string') {
      const prefix = req.body.botPrefix.trim().slice(0, 4) || '.';
      patch.botPrefix = prefix;
    }
    if (typeof req.body?.bannerText === 'string') patch.bannerText = req.body.bannerText.slice(0, 800);
    if (req.body?.extraGb !== undefined) {
      const extraGb = Number(req.body.extraGb);
      if (!Number.isInteger(extraGb) || extraGb < 0 || extraGb > 1024) {
        return void res.status(400).json({ error: 'Espacio extra inválido.' });
      }
      const allocatedOthers = await allocatedExtraGb(user.id, id);
      if (extraGb + allocatedOthers > user.extra_space_gb) {
        const free = Math.max(0, user.extra_space_gb - allocatedOthers);
        return void res.status(400).json({ error: `Solo tienes ${free} GB sin asignar en tu pool. Cómalos en la tienda.` });
      }
      patch.extraGb = extraGb;
    }

    const updated = await updateSubBot(id, user.id, patch);
    if (!updated) return void res.status(404).json({ error: 'Ese sub-bot no existe o no es tuyo.' });
    logger.info('subbots', `${user.email} editó el sub-bot «${updated.name}».`);
    res.json({ bot: withSpace(updated, user.plan) });
  });

  app.delete('/api/subbots/:id', limitWrites, requireUser, async (req, res) => {
    const user = req.webUser!;
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return void res.status(400).json({ error: 'Sub-bot inválido.' });
    const bot = await getSubBot(id, user.id);
    if (!bot) return void res.status(404).json({ error: 'Ese sub-bot no existe o no es tuyo.' });
    await deleteSubBot(id, user.id);
    logger.info('subbots', `${user.email} eliminó el sub-bot «${bot.name}».`);
    res.json({
      ok: true,
      note: bot.token_code ? 'El token usado por este sub-bot queda consumido y no se puede reutilizar.' : null,
    });
  });

  // ------------------------- consola de WhatsApp -------------------------
  // Salud del servicio (Render y monitores externos).
  app.get('/health', async (_req, res) => {
    let db = 'ok';
    try {
      await pool.query('SELECT 1');
    } catch {
      db = 'error';
    }
    res.status(db === 'ok' ? 200 : 503).json({ ok: db === 'ok', db, whatsapp: conn.status });
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
      // WhatsApp solo acepta un código por teléfono cuando la conexión ya está en modo vinculación.
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
    try {
      await pool.query('SELECT 1');
      dbLatencyMs = Date.now() - dbStart;
    } catch {
      dbLatencyMs = null;
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
      time: new Date().toISOString(),
    });
  });

  // Totales reales de la base (grupos, integrantes, personajes, advertencias…).
  app.get('/api/metrics', async (_req, res) => {
    try {
      res.json({ ok: true, metrics: await getPlatformMetrics() });
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

  app.put('/api/banner', limitWrites, async (req, res) => {
    const text = typeof req.body?.text === 'string' ? req.body.text : '';
    if (text.length > 800) return void res.status(400).json({ error: 'El texto del banner no puede pasar de 800 caracteres.' });

    const previous = (await getSetting<Banner>('banner')) ?? { text: '', image: null };
    let image: Banner['image'] = previous.image;
    if (Object.hasOwn(req.body ?? {}, 'image')) {
      image = null;
      if (req.body.image) {
        const { mime, data } = req.body.image as { mime?: string; data?: string };
        if (!mime || !IMAGE_TYPES.includes(mime) || typeof data !== 'string') {
          return void res.status(400).json({ error: 'La imagen debe ser PNG, JPG o WEBP.' });
        }
        if (data.length > Math.ceil((config.defaults.maxBannerBytes * 4) / 3) + 16) {
          return void res.status(400).json({ error: 'La imagen supera el tamaño permitido (1.5 MB).' });
        }
        const bytes = Buffer.from(data, 'base64');
        if (bytes.length === 0 || bytes.length > config.defaults.maxBannerBytes) {
          return void res.status(400).json({ error: 'La imagen supera el tamaño permitido (1.5 MB).' });
        }
        image = { mime, data };
      }
    }

    await setSetting('banner', { text, image });
    logger.info('web', `Banner actualizado${image ? ' (con imagen)' : ''}.`);
    res.json({ ok: true });
  });

  app.delete('/api/banner/image', limitWrites, async (_req, res) => {
    const banner = (await getSetting<Banner>('banner')) ?? { text: '', image: null };
    await setSetting('banner', { text: banner.text, image: null });
    res.json({ ok: true });
  });

  app.get('/api/commands', async (_req, res) => {
    res.json({ settings: getCommandSettings(), commands: getCommandInventory() });
  });

  app.put('/api/commands', limitWrites, async (req, res) => {
    try {
      const activeNames = allCommands().map((command) => command.name);
      const settings = await saveCommandSettings(req.body, activeNames, knownCommandNames());
      logger.info('web', 'Configuración de comandos actualizada.');
      res.json({ ok: true, settings, commands: getCommandInventory(settings) });
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
    }
  });

  app.get('/api/menu', async (_req, res) => {
    const banner = (await getSetting<Banner>('banner')) ?? { text: '', image: null };
    res.json({ text: buildMenu(banner.text) });
  });

  // Consola en vivo (Server-Sent Events), también pública.
  app.get('/api/logs/stream', (req, res) => {
    res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
    res.flushHeaders();
    const send = (entry: LogEntry) => res.write(`data: ${JSON.stringify(entry)}\n\n`);
    recentLogs().forEach(send);
    logBus.on('log', send);
    const ping = setInterval(() => res.write(': ping\n\n'), 25_000);
    req.on('close', () => {
      clearInterval(ping);
      logBus.off('log', send);
    });
  });

  app.use((_req, res) => res.status(404).json({ error: 'No encontrado.' }));
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    logger.error('web', `Error HTTP: ${err.message}`);
    res.status(500).json({ error: 'Error interno.' });
  });

  return app.listen(config.server.port, '0.0.0.0', () => {
    logger.info('web', `Consola pública disponible en el puerto ${config.server.port}.`);
  });
}
