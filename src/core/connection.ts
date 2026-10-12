import makeWASocket, {
  Browsers,
  DisconnectReason,
  jidNormalizedUser,
  type WASocket,
  type BaileysEventMap,
} from '@whiskeysockets/baileys';
import QRCode from 'qrcode';
import pino from 'pino';
import { config } from '../config/index.js';
import { clearPgAuthState, usePgAuthState } from './auth-state.js';
import {
  activePairingCode,
  hasLinkedSession,
  isPendingPairingCreds,
  requestPairing as pairWithCode,
} from './pairing.js';
import { logger } from '../utils/logger.js';
import { maskPhone } from '../utils/text.js';
import { onMessagesUpsert } from '../events/messages.js';
import { onParticipantsUpdate } from '../events/participants.js';

export type ConnStatus = 'idle' | 'connecting' | 'qr' | 'open' | 'closed' | 'logged_out';

export const conn = {
  status: 'idle' as ConnStatus,
  qrDataUrl: null as string | null,
  pairingCode: null as string | null,
  pairingExpiresAt: null as number | null,
  me: null as string | null,
  since: new Date(),
  lastError: null as string | null,
};

let sock: WASocket | null = null;
let attempts = 0;
let reconnectTimer: NodeJS.Timeout | null = null;
let autoPairTimer: NodeJS.Timeout | null = null;
const silentLogger = pino({ level: 'silent' });

export const getSocket = (): WASocket | null => sock;

/** Código de emparejamiento todavía útil para el panel (null si no hay o si ya expiró). */
export function currentPairing(now = Date.now()): { code: string | null; expiresAt: number | null } {
  const code = activePairingCode({ code: conn.pairingCode, expiresAt: conn.pairingExpiresAt }, now);
  if (!code) {
    if (conn.pairingCode) clearPairing();
    return { code: null, expiresAt: null };
  }
  return { code, expiresAt: conn.pairingExpiresAt };
}

function clearPairing(): void {
  conn.pairingCode = null;
  conn.pairingExpiresAt = null;
}

export async function startConnection(): Promise<void> {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  // Un pedido automático pendiente pertenece al socket anterior: si se dispara sobre el nuevo
  // puede pisar el código que alguien pidió desde el panel.
  if (autoPairTimer) {
    clearTimeout(autoPairTimer);
    autoPairTimer = null;
  }
  let { state, saveCreds } = await usePgAuthState();

  // Un emparejamiento abandonado deja creds.me a medio escribir; con eso Baileys intenta iniciar
  // sesión en vez de registrarse y ningún código nuevo funciona. Se descarta y se empieza limpio.
  if (isPendingPairingCreds(state.creds)) {
    logger.warn('conn', 'Se descartó un emparejamiento sin terminar guardado en la base de datos.');
    await clearPgAuthState();
    ({ state, saveCreds } = await usePgAuthState());
  }

  conn.status = 'connecting';
  conn.since = new Date();
  conn.qrDataUrl = null;
  clearPairing();

  const s = makeWASocket({
    auth: state,
    // La etiqueta del sistema operativo llega a WhatsApp como "Chrome (Mac OS)" en el IQ de
    // emparejamiento. Con valores fuera de la lista conocida el servidor rechaza el código por
    // teléfono aunque el QR sí funcione, así que se usa una descripción canónica.
    browser: Browsers.macOS('Chrome'),
    logger: silentLogger,
    markOnlineOnConnect: false,
    syncFullHistory: false,
    generateHighQualityLinkPreview: false,
  });
  sock = s;

  s.ev.on('creds.update', (partial) => {
    // Baileys emite actualizaciones parciales; se mira el estado resultante completo.
    const creds = { ...s.authState.creds, ...(partial ?? {}) };
    // Mientras el emparejamiento no se confirme no se guarda: esas credenciales a medio escribir
    // romperían el próximo arranque (inicio de sesión en vez de registro).
    if (isPendingPairingCreds(creds)) return;
    saveCreds().catch((err) => logger.error('auth', `No se pudieron guardar credenciales: ${err.message}`));
  });

  s.ev.on('connection.update', (update) => {
    handleConnectionUpdate(s, update).catch((err) =>
      logger.error('conn', `Error en connection.update: ${(err as Error).message}`),
    );
  });

  s.ev.on('messages.upsert', (event) => {
    if (event.type !== 'notify') return;
    for (const msg of event.messages) {
      onMessagesUpsert(s, msg).catch((err) =>
        logger.error('msg', `Error procesando mensaje: ${(err as Error).message}`),
      );
    }
  });

  s.ev.on('group-participants.update', (event: BaileysEventMap['group-participants.update']) => {
    onParticipantsUpdate(s, event).catch((err) =>
      logger.error('group', `Error en evento de participantes: ${(err as Error).message}`),
    );
  });
}

async function handleConnectionUpdate(s: WASocket, update: Partial<BaileysEventMap['connection.update']>): Promise<void> {
  if (s !== sock) return; // socket antiguo

  const { connection, lastDisconnect, qr } = update;

  if (qr) {
    // Baileys renueva el QR cada ~20 s. Pedir un código en cada renovación invalidaría el anterior
    // y el teléfono lo rechazaría, así que el automático se pide una sola vez por conexión.
    const firstQr = conn.status !== 'qr';
    conn.status = 'qr';
    conn.qrDataUrl = await QRCode.toDataURL(qr, { margin: 1, width: 320 });
    logger.info('conn', 'Código QR listo. Escanéalo desde la consola web.');
    if (firstQr && config.pairingPhone && !hasLinkedSession(s.authState.creds) && !currentPairing().code) {
      autoPairTimer = setTimeout(() => {
        autoPairTimer = null;
        if (s !== sock) return; // la conexión ya es otra
        requestPairing(config.pairingPhone).catch((err) =>
          logger.warn('conn', `Emparejamiento automático no disponible: ${(err as Error).message}`),
        );
      }, 2000);
    }
  }

  if (connection === 'open') {
    attempts = 0;
    conn.status = 'open';
    conn.qrDataUrl = null;
    clearPairing();
    conn.lastError = null;
    conn.since = new Date();
    conn.me = s.user?.id ? jidNormalizedUser(s.user.id) : null;
    logger.info('conn', `Conectado como ${conn.me ? maskPhone(conn.me) : 'desconocido'}.`);
  }

  if (connection === 'close') {
    const code = (lastDisconnect?.error as { output?: { statusCode?: number } } | undefined)?.output?.statusCode;
    conn.lastError = lastDisconnect?.error?.message ?? null;
    sock = null;
    if (autoPairTimer) {
      clearTimeout(autoPairTimer);
      autoPairTimer = null;
    }
    // El código pertenece a la sesión que acaba de caer: ya no sirve.
    clearPairing();

    if (code === DisconnectReason.loggedOut) {
      conn.status = 'logged_out';
      conn.me = null;
      logger.warn('conn', 'La sesión fue cerrada desde el teléfono. Se borró la sesión guardada.');
      await clearPgAuthState();
      scheduleReconnect(3000);
      return;
    }

    conn.status = 'closed';
    logger.warn('conn', `Conexión cerrada (código ${code ?? 'desconocido'}). Reintentando…`);
    scheduleReconnect(Math.min(60_000, 2_000 * 2 ** attempts));
    attempts += 1;
  }
}

function scheduleReconnect(delayMs: number): void {
  if (reconnectTimer) return;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    startConnection().catch((err) => {
      logger.error('conn', `No se pudo reconectar: ${(err as Error).message}`);
      scheduleReconnect(60_000);
    });
  }, delayMs);
}

/** Pide un código de emparejamiento de 8 caracteres para un número. */
export async function requestPairing(phone: string): Promise<string> {
  const s = sock;
  const { code, expiresAt } = await pairWithCode(
    {
      socket: s,
      // WhatsApp solo acepta el companion_hello después de enviar pair-device (cuando ya hay QR).
      ready: conn.status === 'qr',
      linked: conn.status === 'open' || hasLinkedSession(s?.authState.creds),
    },
    phone,
  );
  conn.pairingCode = code;
  conn.pairingExpiresAt = expiresAt;
  logger.info('conn', 'Código de emparejamiento confirmado por WhatsApp; expira en 60 segundos.');
  return code;
}

/** Cierra la sesión en WhatsApp y vuelve a iniciar para mostrar un nuevo QR. */
export async function logoutBot(): Promise<void> {
  const s = sock;
  clearPairing();
  if (!s) {
    await clearPgAuthState();
    await startConnection();
    return;
  }
  try {
    await s.logout();
  } catch (err) {
    logger.warn('conn', `Logout remoto falló (${(err as Error).message}). Se borra la sesión local.`);
    sock = null;
    await clearPgAuthState();
    await startConnection();
  }
}
