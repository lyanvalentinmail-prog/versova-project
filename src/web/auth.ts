import { randomBytes, randomUUID, scrypt as scryptCb, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import type { NextFunction, Request, Response } from 'express';
import {
  createUser,
  createSession,
  deleteSession,
  findUserByGoogleSub,
  findUserByEmail,
  getSessionUser,
  linkGoogleToUser,
  type WebPlan,
  type WebUser,
} from '../database/store.js';
import { logger } from '../utils/logger.js';
import { hit } from '../utils/ratelimit.js';

const scrypt = promisify(scryptCb) as (password: string, salt: Buffer, keylen: number) => Promise<Buffer>;

/* --------------------------- planes y sub-bots --------------------------- */

export interface PlanInfo {
  id: WebPlan;
  name: string;
  priceUsd: number;
  spacePerBotGb: number;
  maxBots: number;
  color: string;
}

/** Planes de la plataforma: precio, espacio por bot y máximo de bots. */
export const PLANS: Record<WebPlan, PlanInfo> = {
  free: { id: 'free', name: 'Free', priceUsd: 0, spacePerBotGb: 1, maxBots: 3, color: 'free' },
  premium: { id: 'premium', name: 'Premium', priceUsd: 1, spacePerBotGb: 2, maxBots: 5, color: 'premium' },
  vip: { id: 'vip', name: 'VIP', priceUsd: 5, spacePerBotGb: 5, maxBots: 10, color: 'vip' },
};

/** Espacio base de cada sub-bot según su tipo. */
export const BOT_TIERS: Record<'free' | 'premium' | 'vip', { name: string; spaceGb: number; requiresToken: boolean; priceUsd: number }> = {
  free: { name: 'Free', spaceGb: 1, requiresToken: false, priceUsd: 0 },
  premium: { name: 'Premium', spaceGb: 2, requiresToken: true, priceUsd: 1 },
  vip: { name: 'VIP', spaceGb: 4, requiresToken: true, priceUsd: 5 },
};

export interface StoreItem {
  id: string;
  kind: 'token' | 'space' | 'plan' | 'bot' | 'coins' | 'catalog';
  name: string;
  description: string;
  priceUsd: number;
  available: boolean;
  tier?: 'premium' | 'vip';
  spaceGb?: number;
  plan?: WebPlan;
  badge?: string;
  coins?: number;
  catalogSlug?: string;
}

/** Catálogo de la tienda. Los sub-bots «próximamente» no se pueden comprar todavía. */
export const STORE_ITEMS: StoreItem[] = [
  {
    id: 'token-premium',
    kind: 'token',
    name: 'Token Premium',
    description: 'Canjeable al crear un sub-bot Premium (2 GB). Se entrega al instante tras la compra.',
    priceUsd: 1,
    available: true,
    tier: 'premium',
    spaceGb: 2,
  },
  {
    id: 'token-vip',
    kind: 'token',
    name: 'Token VIP',
    description: 'Canjeable al crear un sub-bot VIP (4 GB). Se entrega al instante tras la compra.',
    priceUsd: 5,
    available: true,
    tier: 'vip',
    spaceGb: 4,
  },
  {
    id: 'space-1gb',
    kind: 'space',
    name: '1 GB extra',
    description: 'Espacio adicional en el pool de tu cuenta. Repártelo entre tus sub-bots como quieras.',
    priceUsd: 1,
    available: true,
    spaceGb: 1,
  },
  {
    id: 'plan-premium',
    kind: 'plan',
    name: 'Plan Premium',
    description: 'Hasta 5 sub-bots con 2 GB por bot. Actívalo al instante.',
    priceUsd: 1,
    available: true,
    plan: 'premium',
  },
  {
    id: 'plan-vip',
    kind: 'plan',
    name: 'Plan VIP',
    description: 'Hasta 10 sub-bots con 5 GB por bot. Actívalo al instante.',
    priceUsd: 5,
    available: true,
    plan: 'vip',
  },
  {
    id: 'coins-500',
    kind: 'coins',
    name: '500 V-Coins',
    description: 'Monedas de la plataforma para activar bots del catálogo y comprar mejoras.',
    priceUsd: 2,
    available: true,
    coins: 500,
    badge: 'ECONOMÍA',
  },
  {
    id: 'coins-1600',
    kind: 'coins',
    name: '1600 V-Coins',
    description: '1600 monedas (100 de regalo) para el catálogo y la tienda interna.',
    priceUsd: 5,
    available: true,
    coins: 1600,
    badge: '+100 BONUS',
  },
  {
    id: 'coins-4500',
    kind: 'coins',
    name: '4500 V-Coins',
    description: '4500 monedas (500 de regalo) para desbloquear los bots PRO.',
    priceUsd: 10,
    available: true,
    coins: 4500,
    badge: '+500 BONUS',
  },
  { id: 'bot-musica', kind: 'bot', name: 'Sub-bot de Música', description: 'Descargas, playlists y radio en tu grupo.', priceUsd: 3, available: false, badge: 'Próximamente' },
  { id: 'bot-juegos', kind: 'bot', name: 'Sub-bot de Juegos', description: 'Trivia, dados y rankings para tu team.', priceUsd: 3, available: false, badge: 'Próximamente' },
  { id: 'bot-ia', kind: 'bot', name: 'Sub-bot IA', description: 'Chat inteligente, resúmenes e imágenes.', priceUsd: 8, available: false, badge: 'Próximamente' },
  { id: 'bot-stickers', kind: 'bot', name: 'Sub-bot de Stickers', description: 'Crea stickers desde fotos y videos.', priceUsd: 2, available: false, badge: 'Próximamente' },
];

/* ------------------------------ contraseñas ------------------------------ */

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const derived = await scrypt(password, salt, 64);
  return `scrypt:${salt.toString('hex')}:${derived.toString('hex')}`;
}

export async function verifyPassword(password: string, stored: string | null): Promise<boolean> {
  if (!stored?.startsWith('scrypt:')) return false;
  const [, saltHex, hashHex] = stored.split(':');
  const derived = await scrypt(password, Buffer.from(saltHex, 'hex'), 64);
  const expected = Buffer.from(hashHex, 'hex');
  return derived.length === expected.length && timingSafeEqual(derived, expected);
}

/* -------------------------------- sesiones ------------------------------- */

const SESSION_COOKIE = 'versova_session';
const OAUTH_STATE_COOKIE = 'versova_oauth_state';
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export type SafeUser = {
  id: number;
  email: string;
  name: string;
  picture: string | null;
  plan: WebPlan;
  planInfo: PlanInfo;
  extraSpaceGb: number;
  coins: number;
  handle: string | null;
  avatarUrl: string | null;
  theme: string;
  createdAt: string;
};

export function toSafeUser(user: WebUser): SafeUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name || user.email.split('@')[0],
    picture: user.picture,
    plan: user.plan,
    planInfo: PLANS[user.plan],
    extraSpaceGb: user.extra_space_gb,
    coins: user.coins ?? 0,
    handle: user.handle ?? null,
    avatarUrl: user.avatar_url ?? null,
    theme: user.theme ?? 'dark',
    createdAt: new Date(user.created_at).toISOString(),
  };
}

function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const index = part.indexOf('=');
    if (index < 0) continue;
    const key = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    if (key) out[key] = decodeURIComponent(value);
  }
  return out;
}

function setSessionCookie(req: Request, res: Response, token: string): void {
  res.setHeader(
    'Set-Cookie',
    `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}${req.secure ? '; Secure' : ''}`,
  );
}

function clearSessionCookie(req: Request, res: Response): void {
  res.setHeader('Set-Cookie', `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${req.secure ? '; Secure' : ''}`);
}

async function startSession(req: Request, res: Response, user: WebUser): Promise<void> {
  const token = randomBytes(32).toString('hex');
  await createSession(token, user.id, new Date(Date.now() + SESSION_TTL_MS));
  setSessionCookie(req, res, token);
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      webUser?: WebUser | null;
    }
  }
}

/** Lee la cookie de sesión y deja el usuario (o null) en req.webUser. */
export async function attachUser(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const token = parseCookies(req.headers.cookie)[SESSION_COOKIE];
    req.webUser = token ? await getSessionUser(token) : null;
  } catch (err) {
    logger.warn('auth', `No se pudo leer la sesión: ${(err as Error).message}`);
    req.webUser = null;
  }
  next();
}

export function requireUser(req: Request, res: Response, next: NextFunction): void {
  if (!req.webUser) {
    res.status(401).json({ error: 'Necesitas iniciar sesión para hacer eso.' });
    return;
  }
  next();
}

export function hasSession(req: Request): boolean {
  return Boolean(req.webUser);
}

/* ------------------------------- credenciales ---------------------------- */

const MIN_PASSWORD = 6;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function googleConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID?.trim() && process.env.GOOGLE_CLIENT_SECRET?.trim());
}

export function demoLoginEnabled(): boolean {
  return process.env.DEMO_LOGIN !== '0';
}

function publicAuthState() {
  return { googleEnabled: googleConfigured(), demoLogin: demoLoginEnabled() };
}

export function limitAuth(req: Request, res: Response, next: NextFunction): void {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  if (!hit(`auth:${ip}`, 20, 60_000)) {
    res.status(429).json({ error: 'Demasiados intentos. Espera un momento.' });
    return;
  }
  next();
}

/* -------------------------------- endpoints ------------------------------ */

export async function authMe(req: Request, res: Response): Promise<void> {
  res.json({ user: req.webUser ? toSafeUser(req.webUser) : null, ...publicAuthState() });
}

export async function authRegister(req: Request, res: Response): Promise<void> {
  if (!demoLoginEnabled()) {
    res.status(403).json({ error: 'El registro con email está desactivado. Usa «Continuar con Google».' });
    return;
  }
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';

  if (!EMAIL_RE.test(email)) return void res.status(400).json({ error: 'Escribe un email válido.' });
  if (password.length < MIN_PASSWORD) {
    return void res.status(400).json({ error: `La contraseña necesita al menos ${MIN_PASSWORD} caracteres.` });
  }
  if (name.length > 40) return void res.status(400).json({ error: 'El nombre no puede pasar de 40 caracteres.' });

  const existing = await findUserByEmail(email);
  if (existing) return void res.status(409).json({ error: 'Ya existe una cuenta con ese email. Inicia sesión.' });

  const user = await createUser({ email, name: name || email.split('@')[0], passwordHash: await hashPassword(password) });
  await startSession(req, res, user);
  logger.info('auth', `Cuenta creada: ${user.email}`);
  res.status(201).json({ user: toSafeUser(user), ...publicAuthState() });
}

export async function authLogin(req: Request, res: Response): Promise<void> {
  if (!demoLoginEnabled()) {
    res.status(403).json({ error: 'El acceso con email está desactivado. Usa «Continuar con Google».' });
    return;
  }
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const password = typeof req.body?.password === 'string' ? req.body.password : '';

  const user = EMAIL_RE.test(email) ? await findUserByEmail(email) : null;
  if (!user || !(await verifyPassword(password, user.password_hash))) {
    return void res.status(401).json({ error: 'Email o contraseña incorrectos.' });
  }

  await startSession(req, res, user);
  logger.info('auth', `Inicio de sesión: ${user.email}`);
  res.json({ user: toSafeUser(user), ...publicAuthState() });
}

export async function authLogout(req: Request, res: Response): Promise<void> {
  const token = parseCookies(req.headers.cookie)[SESSION_COOKIE];
  if (token) await deleteSession(token);
  clearSessionCookie(req, res);
  res.json({ ok: true });
}

/* ------------------------------ Google OAuth ----------------------------- */

function googleRedirectUri(req: Request): string {
  const host = req.get('host') ?? `localhost:${process.env.PORT ?? 3000}`;
  return `${req.protocol}://${host}/api/auth/google/callback`;
}

export function googleStart(req: Request, res: Response): void {
  if (!googleConfigured()) {
    res.status(503).json({ error: 'El acceso con Google no está configurado en este servidor. Usa email y contraseña.' });
    return;
  }
  const state = randomUUID();
  res.setHeader(
    'Set-Cookie',
    `${OAUTH_STATE_COOKIE}=${state}; Path=/; HttpOnly; SameSite=Lax; Max-Age=600${req.secure ? '; Secure' : ''}`,
  );
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!.trim(),
    redirect_uri: googleRedirectUri(req),
    response_type: 'code',
    scope: 'openid email profile',
    state,
    prompt: 'select_account',
  });
  res.redirect(302, `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
}

interface GoogleProfile {
  sub: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
}

export async function googleCallback(req: Request, res: Response): Promise<void> {
  const origin = `${req.protocol}://${req.get('host') ?? ''}`;
  const fail = (reason: string) => res.redirect(302, `/?login=1&error=${encodeURIComponent(reason)}`);

  try {
    if (!googleConfigured()) return void fail('El acceso con Google no está configurado en este servidor.');
    const code = typeof req.query.code === 'string' ? req.query.code : '';
    const state = typeof req.query.state === 'string' ? req.query.state : '';
    const expectedState = parseCookies(req.headers.cookie)[OAUTH_STATE_COOKIE];
    if (!code || !state || state !== expectedState) return void fail('La validación de Google falló. Inténtalo otra vez.');

    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID!.trim(),
        client_secret: process.env.GOOGLE_CLIENT_SECRET!.trim(),
        redirect_uri: googleRedirectUri(req),
        grant_type: 'authorization_code',
      }),
    });
    if (!tokenResponse.ok) return void fail('Google rechazó el inicio de sesión.');
    const tokens = (await tokenResponse.json()) as { access_token?: string };
    if (!tokens.access_token) return void fail('Google no devolvió un token válido.');

    const profileResponse = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    if (!profileResponse.ok) return void fail('No se pudo leer tu perfil de Google.');
    const profile = (await profileResponse.json()) as GoogleProfile;
    if (!profile.sub || !profile.email) return void fail('Tu cuenta de Google no comparte el email.');

    let user = await findUserByGoogleSub(profile.sub);
    if (!user) {
      user = await findUserByEmail(profile.email);
      if (user) {
        await linkGoogleToUser(user.id, profile.sub, profile.picture ?? null);
      } else {
        user = await createUser({
          email: profile.email,
          name: profile.name ?? profile.email.split('@')[0],
          googleSub: profile.sub,
          picture: profile.picture ?? null,
        });
      }
    }

    await startSession(req, res, user);
    logger.info('auth', `Inicio de sesión con Google: ${user.email}`);
    res.redirect(302, `${origin}/home`);
  } catch (err) {
    logger.error('auth', `Google OAuth falló: ${(err as Error).message}`);
    fail('No se pudo completar el inicio de sesión con Google.');
  }
}
