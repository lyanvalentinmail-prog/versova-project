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
import { logger } from '../utils/logger.js';
import { digitsOnly, maskPhone } from '../utils/text.js';
import { onMessagesUpsert } from '../events/messages.js';
import { onParticipantsUpdate } from '../events/participants.js';

export type ConnStatus = 'idle' | 'connecting' | 'qr' | 'open' | 'closed' | 'logged_out';

export const conn = {
  status: 'idle' as ConnStatus,
  qrDataUrl: null as string | null,
  pairingCode: null as string | null,
  me: null as string | null,
  since: new Date(),
  lastError: null as string | null,
};

let sock: WASocket | null = null;
let attempts = 0;
let reconnectTimer: NodeJS.Timeout | null = null;
const silentLogger = pino({ level: 'silent' });

export const getSocket = (): WASocket | null => sock;

export async function startConnection(): Promise<void> {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  const { state, saveCreds } = await usePgAuthState();
  conn.status = 'connecting';
  conn.since = new Date();
  conn.qrDataUrl = null;

  const s = makeWASocket({
    auth: state,
    browser: Browsers.ubuntu('Chrome'),
    logger: silentLogger,
    markOnlineOnConnect: false,
    syncFullHistory: false,
    generateHighQualityLinkPreview: false,
  });
  sock = s;

  s.ev.on('creds.update', () => {
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
    conn.status = 'qr';
    conn.qrDataUrl = await QRCode.toDataURL(qr, { margin: 1, width: 320 });
    logger.info('conn', 'Código QR listo. Escanéalo desde la consola web.');
    if (config.pairingPhone && !s.authState.creds.registered) {
      setTimeout(() => {
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
    conn.pairingCode = null;
    conn.lastError = null;
    conn.since = new Date();
    conn.me = s.user?.id ? jidNormalizedUser(s.user.id) : null;
    logger.info('conn', `Conectado como ${conn.me ? maskPhone(conn.me) : 'desconocido'}.`);
  }

  if (connection === 'close') {
    const code = (lastDisconnect?.error as { output?: { statusCode?: number } } | undefined)?.output?.statusCode;
    conn.lastError = lastDisconnect?.error?.message ?? null;
    sock = null;

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
  if (!s) throw new Error('La conexión todavía no está lista. Espera unos segundos.');
  if (s.authState.creds.registered) {
    throw new Error('El bot ya está vinculado. Cierra sesión antes de vincular otro número.');
  }
  const digits = digitsOnly(phone);
  if (digits.length < 8 || digits.length > 15) throw new Error('Número inválido. Usa código de país, sin + ni espacios.');
  const code = await s.requestPairingCode(digits);
  conn.pairingCode = code;
  logger.info('conn', `Código de emparejamiento generado para ${digits.slice(0, 2)}•••${digits.slice(-2)}.`);
  return code;
}

/** Cierra la sesión en WhatsApp y vuelve a iniciar para mostrar un nuevo QR. */
export async function logoutBot(): Promise<void> {
  const s = sock;
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
