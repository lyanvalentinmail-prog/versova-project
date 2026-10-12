import { EventEmitter } from 'node:events';
import { afterAll, describe, expect, it, vi } from 'vitest';
import type { Server as HttpServer } from 'node:http';

/**
 * Prueba el panel web real (Express) contra el módulo de conexión real con un socket falso.
 * Cubre el camino completo del botón "Pedir código": HTTP → requestPairing → respuesta JSON.
 */

const PORT = 3123;
const BASE = `http://127.0.0.1:${PORT}`;
const flush = async (turns = 12) => {
  for (let i = 0; i < turns; i += 1) await new Promise((resolve) => setTimeout(resolve, 0));
};

const harness = vi.hoisted(() => ({
  creds: {} as Record<string, unknown>,
  saved: [] as Array<Record<string, unknown>>,
  sockets: [] as Array<{
    ws: EventEmitter;
    ev: EventEmitter;
    requested: string[];
    authState: { creds: Record<string, unknown> };
  }>,
  reply: 'result' as 'result' | 'error',
}));

vi.mock('../src/core/auth-state.js', () => ({
  usePgAuthState: async () => ({
    state: { creds: harness.creds, keys: { get: async () => ({}), set: async () => undefined } },
    saveCreds: async () => {
      harness.saved.push({ ...harness.creds });
    },
  }),
  clearPgAuthState: async () => {
    harness.creds = {};
  },
}));

vi.mock('@whiskeysockets/baileys', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  const makeFake = (config: { auth: { creds: Record<string, unknown> } }) => {
    const socket = {
      ws: new EventEmitter(),
      ev: new EventEmitter(),
      authState: config.auth,
      user: null,
      requested: [] as string[],
      requestPairingCode: async (phone: string) => {
        socket.requested.push(phone);
        socket.authState.creds.pairingCode = 'QRTP-7788';
        socket.authState.creds.me = { id: `${phone}@s.whatsapp.net`, name: '~' };
        socket.ev.emit('creds.update', socket.authState.creds);
        setImmediate(() => {
          if (harness.reply === 'result') {
            socket.ws.emit('frame', { tag: 'iq', attrs: { type: 'result', id: '21', xmlns: 'md' } });
          } else {
            socket.ws.emit('frame', {
              tag: 'iq',
              attrs: { type: 'error', id: '21' },
              content: [{ tag: 'error', attrs: { code: '400', text: 'bad-request' } }],
            });
          }
        });
        return 'QRTP-7788';
      },
      logout: async () => undefined,
    };
    harness.sockets.push(socket);
    return socket;
  };
  return { ...actual, default: makeFake };
});

process.env.PORT = String(PORT);
const { startWeb } = await import('../src/web/server.js');
const { conn, startConnection } = await import('../src/core/connection.js');

let server: HttpServer | undefined;

async function boot(): Promise<void> {
  server ??= startWeb();
  await new Promise((resolve) => setTimeout(resolve, 30));
  await startConnection();
  const socket = harness.sockets[harness.sockets.length - 1];
  socket.ev.emit('connection.update', { qr: 'ref,noise,identity,adv,1' });
  await flush();
}

afterAll(async () => {
  await new Promise<void>((resolve) => server?.close(() => resolve()));
});

describe('panel web: emparejamiento', () => {
  it('devuelve el código y su vencimiento cuando WhatsApp lo confirma', async () => {
    await boot();

    const statusBefore = await (await fetch(`${BASE}/api/status`)).json();
    expect(statusBefore.whatsapp).toBe('qr');
    expect(statusBefore.pairingReady).toBe(true);
    expect(statusBefore.linked).toBe(false);
    expect(statusBefore.pairingCode).toBeNull();

    const response = await fetch(`${BASE}/api/pair`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: '+598 99 000 111' }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.code).toBe('QRTP-7788');
    expect(body.expiresAt).toBeGreaterThan(Date.now());

    const statusAfter = await (await fetch(`${BASE}/api/status`)).json();
    expect(statusAfter.pairingCode).toBe('QRTP-7788');
    expect(statusAfter.pairingExpiresAt).toBe(body.expiresAt);
  });

  it('responde 400 con el motivo cuando WhatsApp rechaza la solicitud', async () => {
    await boot();
    harness.reply = 'error';

    const response = await fetch(`${BASE}/api/pair`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: '59899000111' }),
    });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain('rechazó la solicitud de emparejamiento');

    const status = await (await fetch(`${BASE}/api/status`)).json();
    expect(status.pairingCode).toBeNull();
    harness.reply = 'result';
  });

  it('responde 400 si el número está mal escrito', async () => {
    await boot();

    const response = await fetch(`${BASE}/api/pair`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: '099 000 111' }),
    });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain('0 inicial');
  });

  it('deja de publicar el código cuando expira', async () => {
    await boot();
    conn.pairingCode = 'VIEJ-0001';
    conn.pairingExpiresAt = Date.now() - 1;

    const status = await (await fetch(`${BASE}/api/status`)).json();
    expect(status.pairingCode).toBeNull();
    expect(status.pairingExpiresAt).toBeNull();
  });
});
