import { EventEmitter } from 'node:events';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { WASocket } from '@whiskeysockets/baileys';
import {
  activePairingCode,
  describePairingFailure,
  hasLinkedSession,
  isPendingPairingCreds,
  normalizePhone,
  PAIRING_CODE_TTL_MS,
  requestPairing,
  waitForPairingAck,
} from '../src/core/pairing.js';
import { conn, currentPairing } from '../src/core/connection.js';

type FakeSocket = {
  socket: WASocket;
  ws: EventEmitter;
  ev: EventEmitter;
  requested: string[];
};

/** Socket falso que imita a Baileys: devuelve el código y luego deja que el "servidor" responda. */
function makeFakeSocket(reply: 'result' | 'error' | 'none' = 'result', code = 'ABCD-1234'): FakeSocket {
  const ws = new EventEmitter();
  const ev = new EventEmitter();
  const requested: string[] = [];

  const socket = {
    ws,
    ev,
    authState: { creds: {} },
    requestPairingCode: async (phone: string) => {
      requested.push(phone);
      setImmediate(() => {
        if (reply === 'result') {
          ws.emit('frame', { tag: 'iq', attrs: { type: 'result', id: '42', xmlns: 'md' } });
        } else if (reply === 'error') {
          ws.emit('frame', {
            tag: 'iq',
            attrs: { type: 'error', id: '42', from: '@s.whatsapp.net' },
            content: [{ tag: 'error', attrs: { code: '400', text: 'bad-request' } }],
          });
        }
      });
      return code;
    },
  } as unknown as WASocket;

  return { socket, ws, ev, requested };
}

afterEach(() => {
  conn.pairingCode = null;
  conn.pairingExpiresAt = null;
});

describe('número para emparejar', () => {
  it('acepta el número con +, espacios o guiones y devuelve solo dígitos', () => {
    expect(normalizePhone('+598 99 123 456')).toEqual({ ok: true, value: '59899123456' });
    expect(normalizePhone('598-99-123-456')).toEqual({ ok: true, value: '59899123456' });
  });

  it('rechaza vacío, demasiado corto y con 0 inicial', () => {
    expect(normalizePhone('').error).toContain('código de país');
    expect(normalizePhone('   ').ok).toBe(false);
    expect(normalizePhone('12345').error).toContain('8 a 15 dígitos');
    expect(normalizePhone('099123456').error).toContain('0 inicial');
  });
});

describe('vigencia del código', () => {
  it('devuelve el código antes de expirar y null después', () => {
    const snapshot = { code: 'ABCD-1234', expiresAt: 1_000 };
    expect(activePairingCode(snapshot, 999)).toBe('ABCD-1234');
    expect(activePairingCode(snapshot, 1_000)).toBeNull();
    expect(activePairingCode({ code: null, expiresAt: null }, 0)).toBeNull();
  });

  it('el estado de la conexión deja de publicar un código vencido', () => {
    conn.pairingCode = 'WXYZ-9876';
    conn.pairingExpiresAt = Date.now() - 1;
    expect(currentPairing().code).toBeNull();
    expect(conn.pairingCode).toBeNull();
  });

  it('el estado de la conexión publica el código mientras esté vivo', () => {
    conn.pairingCode = 'WXYZ-9876';
    conn.pairingExpiresAt = Date.now() + 30_000;
    expect(currentPairing().code).toBe('WXYZ-9876');
  });
});

describe('credenciales de emparejamiento', () => {
  it('detecta un emparejamiento a medio terminar', () => {
    expect(isPendingPairingCreds({ pairingCode: 'ABCD-1234' })).toBe(true);
    expect(isPendingPairingCreds({ pairingCode: 'ABCD-1234', account: {} as never })).toBe(false);
    expect(isPendingPairingCreds({ pairingCode: undefined })).toBe(false);
  });

  it('reconoce una sesión ya vinculada', () => {
    expect(hasLinkedSession({ me: { id: '59899123456@s.whatsapp.net', name: 'Bot' } })).toBe(true);
    // Baileys deja el nombre temporal '~' mientras espera que el teléfono confirme.
    expect(hasLinkedSession({ me: { id: '59899123456@s.whatsapp.net', name: '~' } })).toBe(false);
    expect(hasLinkedSession({})).toBe(false);
  });
});

describe('pedir código desde el panel', () => {
  it('devuelve el código cuando WhatsApp confirma la solicitud', async () => {
    const fake = makeFakeSocket('result');
    const before = Date.now();
    const result = await requestPairing({ socket: fake.socket, ready: true, linked: false }, '+598 99 123 456');

    expect(result.code).toBe('ABCD-1234');
    expect(result.expiresAt).toBeGreaterThanOrEqual(before + PAIRING_CODE_TTL_MS);
    expect(fake.requested).toEqual(['59899123456']);
  });

  it('no entrega un código muerto si WhatsApp rechaza la solicitud', async () => {
    const fake = makeFakeSocket('error');
    await expect(
      requestPairing({ socket: fake.socket, ready: true, linked: false }, '59899123456'),
    ).rejects.toThrow(/rechazó la solicitud de emparejamiento \(400 bad-request\)/);
  });

  it('no pide el código si la conexión todavía no está en modo vinculación', async () => {
    const fake = makeFakeSocket('result');
    await expect(
      requestPairing({ socket: fake.socket, ready: false, linked: false }, '59899123456'),
    ).rejects.toThrow(/aparezca el QR/);
    expect(fake.requested).toEqual([]);
  });

  it('avisa si el bot ya está vinculado', async () => {
    const fake = makeFakeSocket('result');
    await expect(
      requestPairing({ socket: fake.socket, ready: true, linked: true }, '59899123456'),
    ).rejects.toThrow(/ya está vinculado/);
    expect(fake.requested).toEqual([]);
  });

  it('avisa si todavía no hay socket', async () => {
    await expect(
      requestPairing({ socket: null, ready: false, linked: false }, '59899123456'),
    ).rejects.toThrow(/todavía no está lista/);
  });

  it('valida el número antes de tocar WhatsApp', async () => {
    const fake = makeFakeSocket('result');
    await expect(
      requestPairing({ socket: fake.socket, ready: true, linked: false }, '12345'),
    ).rejects.toThrow(/código de país/);
    expect(fake.requested).toEqual([]);
  });

  it('traduce el cierre de conexión de Baileys', async () => {
    const fake = makeFakeSocket('none');
    fake.socket.requestPairingCode = (() => {
      const err = new Error('Connection Closed') as Error & { output: { statusCode: number } };
      err.output = { statusCode: 428 };
      throw err;
    }) as WASocket['requestPairingCode'];

    await expect(
      requestPairing({ socket: fake.socket, ready: true, linked: false }, '59899123456'),
    ).rejects.toThrow(/se cerró mientras se pedía el código/);
  });
});

describe('espera de la respuesta del servidor', () => {
  it('falla si WhatsApp no confirma a tiempo', async () => {
    vi.useFakeTimers();
    try {
      const ws = new EventEmitter();
      const ack = waitForPairingAck(ws, { timeoutMs: 1_000 });
      const assertion = expect(ack.promise).rejects.toThrow(/no confirmó la solicitud/);
      await vi.advanceTimersByTimeAsync(1_000);
      await assertion;
    } finally {
      vi.useRealTimers();
    }
  });

  it('falla si la conexión se cierra mientras se espera', async () => {
    const ws = new EventEmitter();
    const ev = new EventEmitter();
    const ack = waitForPairingAck(ws, { timeoutMs: 5_000, ev });
    const assertion = expect(ack.promise).rejects.toThrow(/se cerró mientras se pedía el código/);
    ev.emit('connection.update', { connection: 'close' });
    await assertion;
  });

  it('ignora el keep-alive y acepta el result del emparejamiento', async () => {
    const ws = new EventEmitter();
    const ack = waitForPairingAck(ws, { timeoutMs: 5_000 });
    ws.emit('frame', { tag: 'iq', attrs: { type: 'result', xmlns: 'w:p', id: '7' } });
    ws.emit('frame', { tag: 'iq', attrs: { type: 'result', xmlns: 'md', id: '8' } });
    await expect(ack.promise).resolves.toBeUndefined();
  });

  it('reporta el límite de solicitudes de WhatsApp', async () => {
    const ws = new EventEmitter();
    const ack = waitForPairingAck(ws, { timeoutMs: 5_000 });
    const assertion = expect(ack.promise).rejects.toThrow(/429/);
    ws.emit('frame', {
      tag: 'iq',
      attrs: { type: 'error', id: '9' },
      content: [{ tag: 'error', attrs: { code: '429', text: 'rate-overlimit' } }],
    });
    await assertion;
  });

  it('traduce los códigos de error conocidos', () => {
    expect(describePairingFailure({ message: 'Connection Closed', output: { statusCode: 428 } })).toContain('se cerró');
    expect(describePairingFailure({ message: 'rate-overlimit', output: { statusCode: 429 } })).toContain('429');
    expect(describePairingFailure(new Error('cualquier otra cosa'))).toBe('cualquier otra cosa');
  });
});
