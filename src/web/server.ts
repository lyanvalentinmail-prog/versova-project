import express, { type NextFunction, type Request, type Response } from 'express';
import type { Server as HttpServer } from 'node:http';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from '../config/index.js';
import { conn, currentPairing, getSocket, logoutBot, requestPairing } from '../core/connection.js';
import { getCommandSettings, saveCommandSettings } from '../core/command-settings.js';
import { allCommands } from '../core/router.js';
import { getCommandInventory, knownCommandNames } from '../commands/catalog.js';
import { getSetting, setSetting } from '../database/repos.js';
import { pool } from '../database/db.js';
import { logBus, logger, recentLogs, type LogEntry } from '../utils/logger.js';
import { hit } from '../utils/ratelimit.js';
import { maskPhone } from '../utils/text.js';
import { buildMenu, DEFAULT_BANNER_TEXT, type Banner } from '../commands/general/menu.js';

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

export function startWeb(): HttpServer {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(express.json({ limit: '3mb' }));
  app.use(express.static(join(here, 'public'), { index: 'index.html' }));

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
