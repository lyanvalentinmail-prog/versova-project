import type { AuthenticationCreds, WASocket } from '@whiskeysockets/baileys';
import type { EventEmitter } from 'node:events';
import { digitsOnly, type ParseResult } from '../utils/text.js';

/**
 * WhatsApp descarta un código de emparejamiento al poco tiempo de generarlo.
 * Usamos el mismo límite para no mostrar en el panel un código que ya no sirve.
 */
export const PAIRING_CODE_TTL_MS = 60_000;

/** Cuánto esperamos la respuesta de WhatsApp al companion_hello antes de dar el código por perdido. */
export const PAIRING_ACK_TIMEOUT_MS = 15_000;

export type PairingSnapshot = { code: string | null; expiresAt: number | null };

export type PairingContext = {
  socket: WASocket | null;
  /** true cuando el servidor ya envió pair-device (hay QR) y por tanto acepta un companion_hello. */
  ready: boolean;
  /** true cuando el bot ya tiene una sesión vinculada. */
  linked: boolean;
};

type Stanza = {
  tag?: string;
  attrs?: Record<string, string | undefined>;
  content?: unknown;
};

/** Normaliza el número del teléfono: solo dígitos, con código de país. */
export function normalizePhone(raw: string): ParseResult<string> {
  const digits = digitsOnly(typeof raw === 'string' ? raw : '');
  if (!digits) {
    return { ok: false, error: 'Escribe el número del bot con código de país. Ejemplo: 59899123456' };
  }
  if (digits.startsWith('0')) {
    return { ok: false, error: 'Quita el 0 inicial y usa el código de país. Ejemplo: 59899123456' };
  }
  if (digits.length < 8 || digits.length > 15) {
    return { ok: false, error: 'Ese número no parece válido. Usa código de país sin + ni espacios (8 a 15 dígitos).' };
  }
  return { ok: true, value: digits };
}

/** Código vigente: null cuando no hay código o cuando ya expiró. */
export function activePairingCode(snapshot: PairingSnapshot, now = Date.now()): string | null {
  if (!snapshot.code || !snapshot.expiresAt) return null;
  return snapshot.expiresAt > now ? snapshot.code : null;
}

/**
 * Credenciales a medio vincular. Al pedir un código, Baileys escribe `creds.me` con el nombre
 * temporal '~' y recién agrega `account` cuando el teléfono confirma. Si ese estado se guarda,
 * el próximo arranque intenta *iniciar sesión* en vez de *registrarse* y el emparejamiento muere.
 */
export function isPendingPairingCreds(creds: Partial<AuthenticationCreds> | null | undefined): boolean {
  if (!creds) return false;
  return Boolean(creds.pairingCode) && !creds.account;
}

/** Una sesión ya vinculada siempre trae `account` (o un `me` con nombre real, no el '~' temporal). */
export function hasLinkedSession(creds: Partial<AuthenticationCreds> | null | undefined): boolean {
  if (!creds) return false;
  if (creds.account) return true;
  return Boolean(creds.me?.id && creds.me.name !== '~');
}

/** Traduce los fallos de Baileys/WhatsApp a un mensaje útil para el panel. */
export function describePairingFailure(err: unknown): string {
  const boom = err as { output?: { statusCode?: number; payload?: { statusCode?: number } }; message?: string };
  const status = boom?.output?.statusCode ?? boom?.output?.payload?.statusCode;
  const message = boom?.message ?? String(err);

  if (status === 428 || /connection closed/i.test(message)) {
    return 'La conexión con WhatsApp se cerró mientras se pedía el código. Espera a que aparezca el QR y vuelve a intentar.';
  }
  if (status === 429 || /429|rate-overlimit|overlimit/i.test(message)) {
    return 'WhatsApp bloqueó las solicitudes por unos minutos (429). Espera y vuelve a intentar.';
  }
  if (status === 400 || status === 401 || /bad-request|not-authorized/i.test(message)) {
    return `WhatsApp rechazó la solicitud de emparejamiento${status ? ` (${status})` : ''}. Revisa el número y vuelve a intentar.`;
  }
  return message;
}

/** Error de un `<iq type="error">` recibido del servidor, ya traducido para el panel. */
function messageFromIqError(frame: Stanza): string {
  const content = Array.isArray(frame.content) ? (frame.content as Stanza[]) : [];
  const attrs = content.find((child) => child?.tag === 'error')?.attrs ?? {};
  const code = attrs.code ? Number(attrs.code) : undefined;
  const text = attrs.text ? String(attrs.text) : '';
  const detail = [code, text].filter((part) => part !== undefined && part !== '').join(' ');

  if (code === 429 || /overlimit/i.test(text)) {
    return 'WhatsApp bloqueó las solicitudes por unos minutos (429). Espera y vuelve a intentar.';
  }
  return `WhatsApp rechazó la solicitud de emparejamiento${detail ? ` (${detail})` : ''}. Revisa el número y vuelve a intentar.`;
}

/** Fuente mínima de `connection.update` (el emisor tipado de Baileys o un EventEmitter de prueba). */
export type ConnectionUpdateSource = {
  on(event: 'connection.update', listener: (update: { connection?: string }) => void): unknown;
  off(event: 'connection.update', listener: (update: { connection?: string }) => void): unknown;
};

export type PairingAck = { promise: Promise<void>; cancel: () => void };

/**
 * Baileys envía el `companion_hello` sin esperar la respuesta del servidor y devuelve el código de
 * forma optimista: si WhatsApp lo rechaza, el panel mostraría un código muerto que el teléfono
 * contesta con "código inválido". Acá escuchamos las tramas del socket para confirmarlo de verdad.
 */
export function waitForPairingAck(
  ws: EventEmitter,
  options: { timeoutMs?: number; ev?: ConnectionUpdateSource } = {},
): PairingAck {
  const timeoutMs = options.timeoutMs ?? PAIRING_ACK_TIMEOUT_MS;
  let settle: (() => void) | undefined;

  const promise = new Promise<void>((resolve, reject) => {
    const onFrame = (frame: Stanza) => {
      const attrs = frame?.attrs ?? {};
      if (frame?.tag !== 'iq') return;
      if (attrs.type === 'error') {
        reject(new Error(messageFromIqError(frame)));
        return;
      }
      // La respuesta al companion_hello es un iq result que no sea el keep-alive (xmlns w:p).
      if (attrs.type === 'result' && attrs.xmlns !== 'w:p') resolve();
    };

    const onConnectionUpdate = (update: { connection?: string }) => {
      if (update?.connection === 'close') {
        reject(new Error('La conexión con WhatsApp se cerró mientras se pedía el código. Vuelve a intentar.'));
      }
    };

    const onTimeout = () => {
      reject(new Error('WhatsApp no confirmó la solicitud de emparejamiento. El código no quedó activo: vuelve a intentar.'));
    };

    ws.on('frame', onFrame);
    options.ev?.on('connection.update', onConnectionUpdate);
    const timer = setTimeout(onTimeout, timeoutMs);

    settle = () => {
      clearTimeout(timer);
      ws.off('frame', onFrame);
      options.ev?.off('connection.update', onConnectionUpdate);
    };
  });

  // Si el servidor no responde, decide el timeout; esto evita una promesa colgada.
  promise.catch(() => undefined);

  return {
    promise,
    cancel: () => settle?.(),
  };
}

/**
 * Pide un código de emparejamiento de 8 caracteres.
 * Solo devuelve el código cuando WhatsApp aceptó la solicitud; si no, lanza un error en español.
 */
export async function requestPairing(
  ctx: PairingContext,
  rawPhone: string,
): Promise<{ code: string; expiresAt: number }> {
  const s = ctx.socket;
  if (ctx.linked) {
    throw new Error('El bot ya está vinculado. Cierra sesión antes de vincular otro número.');
  }
  if (!s) {
    throw new Error('La conexión todavía no está lista. Espera unos segundos y vuelve a intentar.');
  }
  if (!ctx.ready) {
    throw new Error('La conexión aún no está en modo vinculación. Espera a que aparezca el QR y vuelve a intentar.');
  }

  const phone = normalizePhone(rawPhone);
  if (!phone.ok) throw new Error(phone.error);

  // El listener se registra antes del envío para no perder la respuesta del servidor.
  const ack = waitForPairingAck(s.ws, { ev: s.ev });
  let code: string;
  try {
    code = await s.requestPairingCode(phone.value);
  } catch (err) {
    ack.cancel();
    throw new Error(describePairingFailure(err));
  }

  await ack.promise;
  return { code, expiresAt: Date.now() + PAIRING_CODE_TTL_MS };
}
