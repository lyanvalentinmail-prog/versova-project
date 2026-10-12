import { EventEmitter } from 'node:events';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Prueba el ciclo de emparejamiento real de src/core/connection.ts con un socket falso:
 * sin WhatsApp y sin PostgreSQL, pero pasando por el mismo código que usa el panel web.
 */

/** Espera a que terminen los trabajos asíncronos del socket (el QR se渲染 con zlib). */
const flush = async (turns = 12) => {
  for (let i = 0; i < turns; i += 1) await new Promise((resolve) => setTimeout(resolve, 0));
};

type FakeSocket = {
  ws: EventEmitter;
  ev: EventEmitter;
  authState: { creds: Record<string, unknown> };
  user: { id: string } | null;
  requestPairingCode: (phone: string) => Promise<string>;
  requested: string[];
  logout: () => Promise<void>;
};

const harness = vi.hoisted(() => ({
  creds: {} as Record<string, unknown>,
  saved: [] as Array<Record<string, unknown>>,
  cleared: 0,
  sockets: [] as unknown[],
  pairingReply: 'result' as 'result' | 'error' | 'none',
}));

vi.mock('../src/core/auth-state.js', () => ({
  usePgAuthState: async () => ({
    state: {
      creds: harness.creds,
      keys: { get: async () => ({}), set: async () => undefined },
    },
    saveCreds: async () => {
      harness.saved.push({ ...harness.creds });
    },
  }),
  clearPgAuthState: async () => {
    harness.cleared += 1;
    harness.creds = {};
  },
}));

vi.mock('@whiskeysockets/baileys', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  const makeFake = (config: { auth: { creds: Record<string, unknown> } }) => {
    const socket: FakeSocket = {
      ws: new EventEmitter(),
      ev: new EventEmitter(),
      authState: config.auth,
      user: null,
      requested: [],
      requestPairingCode: async (phone: string) => {
        socket.requested.push(phone);
        // Baileys escribe credenciales provisionales y avisa antes de enviar el companion_hello.
        socket.authState.creds.pairingCode = 'ABCD-1234';
        socket.authState.creds.me = { id: `${phone}@s.whatsapp.net`, name: '~' };
        socket.ev.emit('creds.update', socket.authState.creds);
        setImmediate(() => {
          if (harness.pairingReply === 'result') {
            socket.ws.emit('frame', { tag: 'iq', attrs: { type: 'result', id: '11', xmlns: 'md' } });
          } else if (harness.pairingReply === 'error') {
            socket.ws.emit('frame', {
              tag: 'iq',
              attrs: { type: 'error', id: '11' },
              content: [{ tag: 'error', attrs: { code: '400', text: 'bad-request' } }],
            });
          }
        });
        return 'ABCD-1234';
      },
      logout: async () => undefined,
    };
    harness.sockets.push(socket);
    return socket;
  };
  return { ...actual, default: makeFake };
});

process.env.BOT_PHONE = '59899000111';
const { conn, currentPairing, requestPairing, startConnection } = await import('../src/core/connection.js');

const lastSocket = (): FakeSocket => harness.sockets[harness.sockets.length - 1] as FakeSocket;

beforeEach(() => {
  harness.creds = {};
  harness.saved = [];
  harness.cleared = 0;
  harness.sockets = [];
  harness.pairingReply = 'result';
  conn.status = 'idle';
  conn.pairingCode = null;
  conn.pairingExpiresAt = null;
  conn.qrDataUrl = null;
});

afterEach(() => {
  vi.clearAllTimers();
});

describe('conexión y código de emparejamiento', () => {
  it('descarta un emparejamiento a medio terminar guardado en la base', async () => {
    harness.creds = { pairingCode: 'VIEJO-99', me: { id: '59899000111@s.whatsapp.net', name: '~' } };
    await startConnection();
    expect(harness.cleared).toBe(1);
  });

  it('entra en modo vinculación cuando llega el QR', async () => {
    await startConnection();
    lastSocket().ev.emit('connection.update', { qr: 'ref,noise,identity,adv,1' });
    await flush();

    expect(conn.status).toBe('qr');
    expect(conn.qrDataUrl?.startsWith('data:image/png;base64,')).toBe(true);
  });

  it('guarda el código confirmado y deja de publicarlo al expirar', async () => {
    await startConnection();
    lastSocket().ev.emit('connection.update', { qr: 'ref' });
    await flush();

    const code = await requestPairing('+598 99 000 111');
    expect(code).toBe('ABCD-1234');
    expect(currentPairing().code).toBe('ABCD-1234');

    conn.pairingExpiresAt = Date.now() - 1;
    expect(currentPairing().code).toBeNull();
    expect(conn.pairingCode).toBeNull();
  });

  it('no persiste las credenciales provisionales del emparejamiento', async () => {
    await startConnection();
    lastSocket().ev.emit('connection.update', { qr: 'ref' });
    await flush();
    await requestPairing('59899000111');

    expect(lastSocket().requested).toEqual(['59899000111']);
    expect(harness.saved).toEqual([]);
  });

  it('sí persiste las credenciales cuando el vínculo se completa', async () => {
    await startConnection();
    const socket = lastSocket();
    socket.ev.emit('connection.update', { qr: 'ref' });
    await flush();

    // Estado que deja Baileys después del pair-success: account presente y nombre real.
    socket.authState.creds.account = { details: new Uint8Array() };
    socket.authState.creds.me = { id: '59899000111:3@s.whatsapp.net', name: 'Bot', lid: '1@lid' };
    socket.user = { id: '59899000111:3@s.whatsapp.net' };
    socket.ev.emit('creds.update', socket.authState.creds);
    socket.ev.emit('connection.update', { connection: 'open' });
    await flush();

    expect(harness.saved.length).toBeGreaterThan(0);
    expect(conn.status).toBe('open');
    expect(conn.pairingCode).toBeNull();
    // jidNormalizedUser quita el número de dispositivo.
    expect(conn.me).toBe('59899000111@s.whatsapp.net');
  });

  it('rechaza el pedido cuando la conexión todavía no tiene QR', async () => {
    await startConnection();
    await expect(requestPairing('59899000111')).rejects.toThrow(/aparezca el QR/);
    expect(lastSocket().requested).toEqual([]);
  });

  it('no entrega el código cuando WhatsApp lo rechaza', async () => {
    harness.pairingReply = 'error';
    await startConnection();
    lastSocket().ev.emit('connection.update', { qr: 'ref' });
    await flush();

    await expect(requestPairing('59899000111')).rejects.toThrow(/rechazó la solicitud/);
    expect(conn.pairingCode).toBeNull();
    expect(currentPairing().code).toBeNull();
  });

  it('pide el código automático una sola vez y cancela el pendiente al reconectar', async () => {
    await startConnection();
    const first = lastSocket();
    first.ev.emit('connection.update', { qr: 'ref-0' });
    await flush();

    // Reconexión antes de que se dispare el pedido automático de la conexión anterior.
    await startConnection();
    const socket = lastSocket();
    socket.ev.emit('connection.update', { qr: 'ref-1' });
    await flush();
    // Baileys renueva el QR cada ~20 s; cada renovación solía pedir un código nuevo.
    socket.ev.emit('connection.update', { qr: 'ref-2' });
    socket.ev.emit('connection.update', { qr: 'ref-3' });
    await flush();

    // El disparador automático corre 2 s después del primer QR.
    await new Promise((resolve) => setTimeout(resolve, 2_100));
    await flush();

    expect(first.requested).toEqual([]);
    expect(socket.requested).toEqual(['59899000111']);
  }, 15_000);

  it('descarta el código cuando la conexión se cae', async () => {
    await startConnection();
    const socket = lastSocket();
    socket.ev.emit('connection.update', { qr: 'ref' });
    await flush();
    await requestPairing('59899000111');
    expect(conn.pairingCode).toBe('ABCD-1234');

    // Timers falsos solo para que el reintento automático no corra durante la prueba.
    vi.useFakeTimers();
    try {
      socket.ev.emit('connection.update', { connection: 'close', lastDisconnect: { error: new Error('boom') } });
      await Promise.resolve();
      await Promise.resolve();

      expect(conn.status).toBe('closed');
      expect(currentPairing().code).toBeNull();
    } finally {
      vi.clearAllTimers();
      vi.useRealTimers();
    }
  });
});
