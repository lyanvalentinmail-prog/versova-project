import express, { type NextFunction, type Request, type Response } from 'express';
import { timingSafeEqual } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from '../config/index.js';
import { conn, getSocket, logoutBot, requestPairing } from '../core/connection.js';
import { getSetting, setSetting } from '../database/repos.js';
import { pool } from '../database/db.js';
import { logBus, logger, recentLogs, type LogEntry } from '../utils/logger.js';
import { DEFAULT_BANNER_TEXT, type Banner } from '../commands/general/menu.js';

const here = dirname(fileURLToPath(import.meta.url));
const startedAt = new Date();
const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

function keyOk(provided: string | undefined): boolean {
  if (!provided) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(config.console.key);
  return a.length === b.length && timingSafeEqual(a, b);
}

function requireKey(req: Request, res: Response, next: NextFunction): void {
  const provided = req.get('x-console-key') ?? (typeof req.query.key === 'string' ? req.query.key : undefined);
  if (!keyOk(provided)) {
    res.status(401).json({ error: 'Clave incorrecta.' });
    return;
  }
  next();
}

export function startWeb(): void {
  const app = express();
  app.disable('x-powered-by');
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

  app.get('/api/status', requireKey, async (_req, res) => {
    res.json({
      bot: config.bot.name,
      team: config.bot.team,
      version: config.bot.version,
      prefix: config.bot.prefix,
      whatsapp: conn.status,
      me: conn.me,
      since: conn.since,
      lastError: conn.lastError,
      qr: conn.qrDataUrl,
      pairingCode: conn.pairingCode,
      uptimeSec: Math.floor((Date.now() - startedAt.getTime()) / 1000),
      connected: Boolean(getSocket()),
    });
  });

  app.post('/api/pair', requireKey, async (req, res) => {
    const phone = typeof req.body?.phone === 'string' ? req.body.phone : '';
    try {
      const code = await requestPairing(phone);
      res.json({ code });
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
    }
  });

  app.post('/api/logout', requireKey, async (_req, res) => {
    try {
      await logoutBot();
      res.json({ ok: true });
    } catch (err) {
      logger.error('web', `Logout falló: ${(err as Error).message}`);
      res.status(500).json({ error: 'No se pudo cerrar la sesión.' });
    }
  });

  app.get('/api/banner', requireKey, async (_req, res) => {
    const banner = (await getSetting<Banner>('banner')) ?? { text: '', image: null };
    res.json({
      text: banner.text,
      defaultText: DEFAULT_BANNER_TEXT,
      hasImage: Boolean(banner.image),
      imageMime: banner.image?.mime ?? null,
    });
  });

  app.put('/api/banner', requireKey, async (req, res) => {
    const text = typeof req.body?.text === 'string' ? req.body.text : '';
    if (text.length > 800) return void res.status(400).json({ error: 'El texto del banner no puede pasar de 800 caracteres.' });

    let image: Banner['image'] = null;
    if (req.body?.image) {
      const { mime, data } = req.body.image as { mime?: string; data?: string };
      if (!mime || !IMAGE_TYPES.includes(mime) || typeof data !== 'string') {
        return void res.status(400).json({ error: 'La imagen debe ser PNG, JPG o WEBP.' });
      }
      const size = Buffer.from(data, 'base64').length;
      if (size === 0 || size > config.defaults.maxBannerBytes) {
        return void res.status(400).json({ error: 'La imagen supera el tamaño permitido (1.5 MB).' });
      }
      image = { mime, data };
    }
    await setSetting('banner', { text, image });
    logger.info('web', `Banner actualizado${image ? ' (con imagen)' : ''}.`);
    res.json({ ok: true });
  });

  app.delete('/api/banner/image', requireKey, async (_req, res) => {
    const banner = (await getSetting<Banner>('banner')) ?? { text: '', image: null };
    await setSetting('banner', { text: banner.text, image: null });
    res.json({ ok: true });
  });

  // Consola en vivo (Server-Sent Events).
  app.get('/api/logs/stream', requireKey, (req, res) => {
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

  app.listen(config.server.port, '0.0.0.0', () => {
    logger.info('web', `Consola disponible en el puerto ${config.server.port}.`);
  });
}
