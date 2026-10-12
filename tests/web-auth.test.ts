import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Server as HttpServer } from 'node:http';

/**
 * Pruebas de integración de la capa de cuenta de la web:
 * registro/acceso (demo y Google), tienda (tokens, espacio, planes) y sub-bots.
 * Requiere TEST_DATABASE_URL apuntando a un PostgreSQL real (igual que db.test.ts).
 */

const PORT = 3128;
const BASE = `http://127.0.0.1:${PORT}`;
const enabled = Boolean(process.env.TEST_DATABASE_URL);

const uniqueEmail = () => `auth-${Date.now()}-${Math.round(Math.random() * 1e6)}@versova.dev`;

process.env.PORT = String(PORT);
const { startWeb } = await import('../src/web/server.js');
const { migrate } = await import('../src/database/db.js');

let server: HttpServer | undefined;

interface Session {
  cookie?: string;
}

async function call(path: string, init: RequestInit = {}, session?: Session): Promise<{ status: number; body: any; headers: Headers }> {
  const headers = new Headers(init.headers);
  if (init.body) headers.set('Content-Type', 'application/json');
  if (session?.cookie) headers.set('Cookie', session.cookie);
  const response = await fetch(`${BASE}${path}`, { ...init, headers, redirect: 'manual' });
  let body: any = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }
  return { status: response.status, body, headers: response.headers };
}

async function registerSession(): Promise<Session & { email: string }> {
  const email = uniqueEmail();
  const { status, headers } = await call('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password: 'secreto-123', name: 'Cuenta de prueba' }),
  });
  expect(status).toBe(201);
  return { cookie: headers.get('set-cookie')?.split(';')[0], email };
}

describe.skipIf(!enabled)('cuenta, tienda y sub-bots', () => {
  beforeAll(async () => {
    server ??= startWeb();
    await migrate();
    await new Promise((resolve) => setTimeout(resolve, 30));
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server?.close(() => resolve()));
  });

  it('el acceso con Google responde 503 cuando no está configurado', async () => {
    const savedId = process.env.GOOGLE_CLIENT_ID;
    const savedSecret = process.env.GOOGLE_CLIENT_SECRET;
    delete process.env.GOOGLE_CLIENT_ID;
    delete process.env.GOOGLE_CLIENT_SECRET;
    try {
      const { status, body } = await call('/api/auth/google/start');
      expect(status).toBe(503);
      expect(body.error).toContain('Google no está configurado');
    } finally {
      if (savedId) process.env.GOOGLE_CLIENT_ID = savedId;
      if (savedSecret) process.env.GOOGLE_CLIENT_SECRET = savedSecret;
    }
  });

  it('registra, entrega sesión y expone el perfil en /api/auth/me', async () => {
    const session = await registerSession();
    expect(session.cookie).toContain('versova_session=');

    const me = await call('/api/auth/me', {}, session);
    expect(me.status).toBe(200);
    expect(me.body.user.plan).toBe('free');
    expect(me.body.googleEnabled).toBe(false);
    expect(me.body.demoLogin).toBe(true);
  });

  it('rechaza registros duplicados y contraseñas cortas', async () => {
    const session = await registerSession();
    const duplicate = await call('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email: session.email, password: 'secreto-123' }),
    });
    expect(duplicate.status).toBe(409);

    const weak = await call('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email: uniqueEmail(), password: '123' }),
    });
    expect(weak.status).toBe(400);
  });

  it('inicia sesión con email y clave y cierra la sesión', async () => {
    const session = await registerSession();

    const wrong = await call('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'no-existe@versova.dev', password: 'otra-clave' }),
    });
    expect(wrong.status).toBe(401);

    const ok = await call('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: session.email, password: 'secreto-123' }),
    });
    expect(ok.status).toBe(200);
    expect(ok.headers.get('set-cookie')).toContain('versova_session=');

    const cookie = ok.headers.get('set-cookie')!.split(';')[0];
    const logout = await call('/api/auth/logout', { method: 'POST' }, { cookie });
    expect(logout.status).toBe(200);

    const me = await call('/api/auth/me', {}, { cookie });
    expect(me.body.user).toBeNull();
  });

  it('exige sesión para la tienda, los sub-bots y el panel', async () => {
    const store = await call('/api/store/catalog');
    expect(store.status).toBe(401);

    const bots = await call('/api/subbots');
    expect(bots.status).toBe(401);

    const home = await fetch(`${BASE}/home`, { redirect: 'manual' });
    expect(home.status).toBe(302);
    expect(home.headers.get('location')).toBe('/?login=1');

    const storePage = await fetch(`${BASE}/store`, { redirect: 'manual' });
    expect(storePage.status).toBe(302);
    expect(storePage.headers.get('location')).toBe('/?login=1&next=store');
  });

  it('compra un token premium y lo entrega con código sin usar', async () => {
    const session = await registerSession();

    const checkout = await call('/api/store/checkout', {
      method: 'POST',
      body: JSON.stringify({ itemId: 'token-premium', quantity: 1 }),
    }, session);
    expect(checkout.status).toBe(200);
    expect(checkout.body.receipt.tokens).toHaveLength(1);
    const code: string = checkout.body.receipt.tokens[0].code;
    expect(code).toMatch(/^VRSOV-PREM-[A-Z2-9]{4}-[A-Z2-9]{4}$/);

    const tokens = await call('/api/store/tokens', {}, session);
    expect(tokens.body.tokens).toHaveLength(1);
    expect(tokens.body.tokens[0]).toMatchObject({ code, type: 'premium', status: 'unused', space_gb: 2 });

    const bad = await call('/api/store/checkout', {
      method: 'POST',
      body: JSON.stringify({ itemId: 'no-existe' }),
    }, session);
    expect(bad.status).toBe(404);
  });

  it('respeta el máximo de bots del plan free (3)', async () => {
    const session = await registerSession();
    for (let i = 0; i < 3; i += 1) {
      const created = await call('/api/subbots', {
        method: 'POST',
        body: JSON.stringify({ name: `Bot libre ${i}`, tier: 'free' }),
      }, session);
      expect(created.status).toBe(201);
      expect(created.body.bot.totalSpaceGb).toBe(1);
    }
    const fourth = await call('/api/subbots', {
      method: 'POST',
      body: JSON.stringify({ name: 'Bot de más', tier: 'free' }),
    }, session);
    expect(fourth.status).toBe(403);
    expect(fourth.body.error).toContain('permite hasta 3 bots');
  });

  it('crea un sub-bot premium canjeando su token y rechaza reusarlo', async () => {
    const session = await registerSession();

    const withoutToken = await call('/api/subbots', {
      method: 'POST',
      body: JSON.stringify({ name: 'Premium sin token', tier: 'premium' }),
    }, session);
    expect(withoutToken.status).toBe(400);

    const invalidToken = await call('/api/subbots', {
      method: 'POST',
      body: JSON.stringify({ name: 'Premium token falso', tier: 'premium', tokenCode: 'VRSOV-PREM-0000-0000' }),
    }, session);
    expect(invalidToken.status).toBe(400);

    const boughtVip = await call('/api/store/checkout', {
      method: 'POST',
      body: JSON.stringify({ itemId: 'token-vip', quantity: 1 }),
    }, session);
    const vipCode: string = boughtVip.body.receipt.tokens[0].code;

    const wrongType = await call('/api/subbots', {
      method: 'POST',
      body: JSON.stringify({ name: 'Premium con token vip', tier: 'premium', tokenCode: vipCode }),
    }, session);
    expect(wrongType.status).toBe(400);

    const boughtPremium = await call('/api/store/checkout', {
      method: 'POST',
      body: JSON.stringify({ itemId: 'token-premium', quantity: 1 }),
    }, session);
    const premiumCode: string = boughtPremium.body.receipt.tokens[0].code;

    const created = await call('/api/subbots', {
      method: 'POST',
      body: JSON.stringify({ name: 'Premium con token', tier: 'premium', tokenCode: premiumCode.toLowerCase(), phone: '598 99 111 222' }),
    }, session);
    expect(created.status).toBe(201);
    expect(created.body.bot.totalSpaceGb).toBe(2);
    expect(created.body.bot.token_code).toBe(premiumCode);

    const reuse = await call('/api/subbots', {
      method: 'POST',
      body: JSON.stringify({ name: 'Reuso de token', tier: 'premium', tokenCode: premiumCode }),
    }, session);
    expect(reuse.status).toBe(400);

    const list = await call('/api/subbots', {}, session);
    expect(list.body.bots).toHaveLength(1);
    expect(list.body.tokens).toHaveLength(1); // queda solo el token vip sin usar
  });

  it('compra espacio extra y lo asigna a un sub-bot sin pasarse del pool', async () => {
    const session = await registerSession();
    const bot = await call('/api/subbots', {
      method: 'POST',
      body: JSON.stringify({ name: 'Bot con espacio', tier: 'free' }),
    }, session);
    const botId = bot.body.bot.id;

    const buy = await call('/api/store/checkout', {
      method: 'POST',
      body: JSON.stringify({ itemId: 'space-1gb', quantity: 2 }),
    }, session);
    expect(buy.status).toBe(200);
    expect(buy.body.receipt.spaceGb).toBe(2);

    const over = await call(`/api/subbots/${botId}`, {
      method: 'PUT',
      body: JSON.stringify({ extraGb: 3 }),
    }, session);
    expect(over.status).toBe(400);

    const assign = await call(`/api/subbots/${botId}`, {
      method: 'PUT',
      body: JSON.stringify({ extraGb: 2, name: 'Bot con espacio ampliado' }),
    }, session);
    expect(assign.status).toBe(200);
    expect(assign.body.bot.extra_gb).toBe(2);
    expect(assign.body.bot.totalSpaceGb).toBe(3);

    const catalog = await call('/api/store/catalog', {}, session);
    expect(catalog.body.usage.extraSpaceFree).toBe(0);
  });

  it('activa el plan vip desde la tienda y sube el límite de bots', async () => {
    const session = await registerSession();

    const vip = await call('/api/store/checkout', {
      method: 'POST',
      body: JSON.stringify({ itemId: 'plan-vip' }),
    }, session);
    expect(vip.status).toBe(200);
    expect(vip.body.receipt.plan).toBe('vip');

    const again = await call('/api/store/checkout', {
      method: 'POST',
      body: JSON.stringify({ itemId: 'plan-vip' }),
    }, session);
    expect(again.status).toBe(400);

    const bots = await call('/api/subbots', {}, session);
    expect(bots.body.plan.id).toBe('vip');
    expect(bots.body.usage.botsMax).toBe(10);

    const bot = await call('/api/subbots', {
      method: 'POST',
      body: JSON.stringify({ name: 'Bot en plan vip', tier: 'free' }),
    }, session);
    expect(bot.status).toBe(201);
    // El espacio por bot es el mayor entre el tipo (1 GB) y el plan vip (5 GB).
    expect(bot.body.bot.totalSpaceGb).toBe(5);

    const removed = await call(`/api/subbots/${bot.body.bot.id}`, { method: 'DELETE' }, session);
    expect(removed.status).toBe(200);
    expect(removed.body.note).toBeNull();

    const history = await call('/api/store/catalog', {}, session);
    expect(history.body.purchases.length).toBeGreaterThanOrEqual(1);
  });
});
