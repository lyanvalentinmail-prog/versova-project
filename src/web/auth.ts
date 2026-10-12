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

/** Planes de la plataforma: espacio por bot y máximo de bots. Todo es gratuito (0 $). */
export const PLANS: Record<WebPlan, PlanInfo> = {
  free: { id: 'free', name: 'Free', priceUsd: 0, spacePerBotGb: 1, maxBots: 3, color: 'free' },
  premium: { id: 'premium', name: 'Premium', priceUsd: 0, spacePerBotGb: 2, maxBots: 5, color: 'premium' },
  vip: { id: 'vip', name: 'VIP', priceUsd: 0, spacePerBotGb: 5, maxBots: 10, color: 'vip' },
};

/** Orden de los planes para comparar upgrades (todo cuesta 0 $, se compara por nivel). */
export const PLAN_RANK: Record<WebPlan, number> = { free: 0, premium: 1, vip: 2 };

/** Espacio base de cada sub-bot según su tipo. Todo es gratuito (0 $). */
export const BOT_TIERS: Record<'free' | 'premium' | 'vip', { name: string; spaceGb: number; requiresToken: boolean; priceUsd: number }> = {
  free: { name: 'Free', spaceGb: 1, requiresToken: false, priceUsd: 0 },
  premium: { name: 'Premium', spaceGb: 2, requiresToken: true, priceUsd: 0 },
  vip: { name: 'VIP', spaceGb: 4, requiresToken: true, priceUsd: 0 },
};

export interface StoreItem {
  id: string;
  kind: 'token' | 'space' | 'plan' | 'bot' | 'catalog';
  name: string;
  description: string;
  priceUsd: number;
  available: boolean;
  tier?: 'premium' | 'vip';
  spaceGb?: number;
  plan?: WebPlan;
  badge?: string;
  catalogSlug?: string;
}

/**
 * Catálogo de la tienda. Todo vale 0 $: la entrega es instantánea y el cobro es
 * de demostración (no se cobra dinero real).
 */
export const STORE_ITEMS: StoreItem[] = [
  {
    id: 'token-premium',
    kind: 'token',
    name: 'Token Premium',
    description: 'Canjeable al crear un sub-bot Premium (2 GB). Se entrega al instante.',
    priceUsd: 0,
    available: true,
    tier: 'premium',
    spaceGb: 2,
    badge: 'GRATIS',
  },
  {
    id: 'token-vip',
    kind: 'token',
    name: 'Token VIP',
    description: 'Canjeable al crear un sub-bot VIP (4 GB). Se entrega al instante.',
    priceUsd: 0,
    available: true,
    tier: 'vip',
    spaceGb: 4,
    badge: 'GRATIS',
  },
  {
    id: 'space-1gb',
    kind: 'space',
    name: '1 GB extra',
    description: 'Espacio adicional en el pool de tu cuenta. Repártelo entre tus sub-bots como quieras.',
    priceUsd: 0,
    available: true,
    spaceGb: 1,
  },
  {
    id: 'plan-premium',
    kind: 'plan',
    name: 'Plan Premium',
    description: 'Hasta 5 sub-bots con 2 GB por bot. Actívalo al instante.',
    priceUsd: 0,
    available: true,
    plan: 'premium',
  },
  {
    id: 'plan-vip',
    kind: 'plan',
    name: 'Plan VIP',
    description: 'Hasta 10 sub-bots con 5 GB por bot. Actívalo al instante.',
    priceUsd: 0,
    available: true,
    plan: 'vip',
    badge: 'TOP',
  },
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

const OAUTH_NEXT_COOKIE = 'versova_oauth_next';

/** Páginas internas a las que se puede volver tras iniciar sesión con Google. */
const OAUTH_NEXT_PATHS = new Set(['/', '/registrar', '/bots', '/metrics', '/store', '/catalog', '/ticket']);

function sanitizeNextPath(raw: unknown): string | null {
  if (typeof raw !== 'string' || !raw.startsWith('/') || raw.startsWith('//')) return null;
  const path = raw.split('?')[0].split('#')[0];
  return OAUTH_NEXT_PATHS.has(path) ? path : null;
}

/**
 * Construye la redirect URI con el host/protocolo reales de la petición
 * (`trust proxy` ya aplica): así funciona igual en local que tras un proxy HTTPS.
 */
function googleRedirectUri(req: Request): string {
  const host = req.get('host') ?? `localhost:${process.env.PORT ?? 3000}`;
  return `${req.protocol}://${host}/api/auth/google/callback`;
}

function clearOauthCookies(req: Request, res: Response): void {
  const secure = req.secure ? '; Secure' : '';
  res.setHeader(
    'Set-Cookie',
    [
      `${OAUTH_STATE_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`,
      `${OAUTH_NEXT_COOKIE}=; Path=/; SameSite=Lax; Max-Age=0${secure}`,
    ],
  );
}

export function googleStart(req: Request, res: Response): void {
  if (!googleConfigured()) {
    res.status(503).json({ error: 'El acceso con Google no está configurado en este servidor. Usa email y contraseña.' });
    return;
  }
  const state = randomUUID();
  const secure = req.secure ? '; Secure' : '';
  const cookies = [
    `${OAUTH_STATE_COOKIE}=${state}; Path=/; HttpOnly; SameSite=Lax; Max-Age=600${secure}`,
  ];
  const next = sanitizeNextPath(req.query.next);
  if (next) cookies.push(`${OAUTH_NEXT_COOKIE}=${encodeURIComponent(next)}; Path=/; SameSite=Lax; Max-Age=600${secure}`);
  res.setHeader('Set-Cookie', cookies);
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

/** Traduce los errores que Google devuelve en la redirect URI. */
function googleErrorReason(raw: string): string {
  switch (raw) {
    case 'access_denied':
      return 'Cancelaste el acceso de Google. Inténtalo otra vez cuando quieras.';
    case 'invalid_scope':
      return 'Google rechazó los permisos solicitados. Inténtalo otra vez.';
    case 'unsupported_response_type':
      return 'El flujo de Google no está configurado correctamente en el servidor.';
    default:
      return `Google devolvió un error (${raw}). Inténtalo otra vez.`;
  }
}

export async function googleCallback(req: Request, res: Response): Promise<void> {
  const cookies = parseCookies(req.headers.cookie);
  const nextPath = sanitizeNextPath(cookies[OAUTH_NEXT_COOKIE] ?? req.query.next);
  const fail = (reason: string) =>
    res.redirect(302, `/?login=1&error=${encodeURIComponent(reason)}${nextPath && nextPath !== '/' ? `&next=${encodeURIComponent(nextPath)}` : ''}`);

  try {
    if (!googleConfigured()) return void fail('El acceso con Google no está configurado en este servidor.');

    // Google redirige con ?error=... cuando el usuario cancela o algo falla en su lado.
    const oauthError = typeof req.query.error === 'string' ? req.query.error : '';
    if (oauthError) return void fail(googleErrorReason(oauthError));

    const code = typeof req.query.code === 'string' ? req.query.code : '';
    const state = typeof req.query.state === 'string' ? req.query.state : '';
    const expectedState = cookies[OAUTH_STATE_COOKIE];
    if (!code || !state || !expectedState || state !== expectedState) {
      return void fail('La validación de Google falló. Inténtalo otra vez.');
    }

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
    if (!tokenResponse.ok) {
      logger.warn('auth', `Google token endpoint respondió ${tokenResponse.status}.`);
      return void fail('Google rechazó el inicio de sesión. Inténtalo otra vez.');
    }
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
    clearOauthCookies(req, res);
    logger.info('auth', `Inicio de sesión con Google: ${user.email}`);
    res.redirect(302, nextPath ?? '/');
  } catch (err) {
    logger.error('auth', `Google OAuth falló: ${(err as Error).message}`);
    fail('No se pudo completar el inicio de sesión con Google.');
  }
}
