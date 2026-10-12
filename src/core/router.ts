import { normalizeMessageContent, type GroupMetadata, type WAMessage, type WASocket } from '@whiskeysockets/baileys';
import { config } from '../config/index.js';
import {
  commandForPack,
  commandsForPack,
  DEFAULT_PACK_SLUG,
  registerCoreCommand,
  type Command,
  type Ctx,
} from './bot-packs.js';
import { getActiveBotSlug } from './active-bot.js';
import { getCommandSettings, resolveCommandAlias } from './command-settings.js';
import { claimMessage, isBlocked } from '../database/repos.js';
import { logger } from '../utils/logger.js';
import { hit } from '../utils/ratelimit.js';
import { normalizeJid } from '../utils/text.js';
import { botIsAdmin, getGroupMeta, isAdminIn, isOwner } from './permissions.js';

export type { Command, Ctx, CommandCategory, GuardCtx, BotGuard, BotPack } from './bot-packs.js';

/**
 * Registro de comandos del núcleo (pack VÉRSOVA). Los packs de `bots/` añaden los
 * suyos con `registerPackCommand` y pueden reemplazar un comando heredado usando el
 * mismo nombre.
 */
export function register(...commands: Command[]): void {
  registerCoreCommand(...commands);
}

/** Comandos efectivos del pack indicado (por defecto, el bot base). */
export const allCommands = (pack: string = DEFAULT_PACK_SLUG): Command[] => commandsForPack(pack);

export function extractText(msg: WAMessage): string {
  const m = normalizeMessageContent(msg.message);
  return (
    m?.conversation ??
    m?.extendedTextMessage?.text ??
    m?.imageMessage?.caption ??
    m?.videoMessage?.caption ??
    ''
  );
}

function contextInfoOf(msg: WAMessage) {
  const m = normalizeMessageContent(msg.message);
  return (
    m?.extendedTextMessage?.contextInfo ??
    m?.imageMessage?.contextInfo ??
    m?.videoMessage?.contextInfo ??
    undefined
  );
}

/** Procesa un mensaje si es un comando válido. Los comandos no válidos se ignoran en silencio. */
export async function handleCommand(sock: WASocket, msg: WAMessage): Promise<void> {
  const chat = msg.key.remoteJid;
  if (!chat) return;
  const isGroup = chat.endsWith('@g.us');

  const text = extractText(msg).trim();
  if (!text.startsWith(config.bot.prefix)) return;

  // El bot activo decide qué comandos existen: el núcleo o los del pack instalado.
  const pack = getActiveBotSlug();
  const settings = getCommandSettings(pack);

  const [head = '', ...rest] = text.slice(config.bot.prefix.length).split(/\s+/);
  const name = resolveCommandAlias(pack, head.toLowerCase());
  const command = commandForPack(pack, name);
  if (!command || settings.disabled.includes(name)) return;

  const rawSender = isGroup ? msg.key.participant : chat;
  if (!rawSender || !msg.key.id) return;
  const sender = normalizeJid(rawSender);

  // Evita ejecutar dos veces el mismo mensaje.
  if (!(await claimMessage(msg.key.id))) return;

  const ctxInfo = contextInfoOf(msg);
  const reply: Ctx['reply'] = async (body, mentions) => {
    try {
      return await sock.sendMessage(chat, { text: body, mentions: mentions ?? [] }, { quoted: msg });
    } catch (err) {
      logger.error('send', `No se pudo enviar mensaje: ${(err as Error).message}`);
      return undefined;
    }
  };

  if (!hit(`${sender}:${chat}`, config.defaults.rateLimit.max, config.defaults.rateLimit.windowMs)) {
    await reply('⏳ Demasiados comandos seguidos. Espera unos segundos, por favor.');
    return;
  }

  if (command.groupOnly && !isGroup) {
    await reply('Este comando solo funciona dentro de un grupo del team.');
    return;
  }

  let meta: GroupMetadata | null = null;
  let admin = false;
  let botAdmin = false;
  if (isGroup) {
    meta = await getGroupMeta(sock, chat);
    admin = isAdminIn(meta, sender);
    botAdmin = botIsAdmin(meta, sock);
  }
  const owner = isOwner(sender);

  // Un integrante bloqueado con .ban no recibe respuestas del bot (salvo el owner).
  if (isGroup && !owner && (await isBlocked(chat, sender))) return;

  if (command.ownerOnly && !owner) {
    await reply('⛔ Este comando es exclusivo del propietario del bot.');
    return;
  }
  if (command.adminOnly && !admin && !owner) {
    await reply('⛔ Este comando es exclusivo para administradores del grupo.');
    return;
  }
  if (command.needsBotAdmin && !botAdmin) {
    await reply('⚠️ Necesito ser administrador del grupo para hacer esto.');
    return;
  }

  const ctx: Ctx = {
    sock,
    msg,
    chat,
    isGroup,
    groupId: isGroup ? chat : '',
    sender,
    senderName: msg.pushName ?? '',
    command: name,
    pack,
    args: rest.filter(Boolean),
    argText: text.slice(config.bot.prefix.length + head.length).trim(),
    mentions: (ctxInfo?.mentionedJid ?? []).map(normalizeJid),
    quotedId: ctxInfo?.stanzaId ?? null,
    meta,
    isAdmin: admin,
    isOwner: owner,
    botIsAdmin: botAdmin,
    reply,
  };

  try {
    await command.run(ctx);
  } catch (err) {
    logger.error('cmd', `.${name} falló: ${(err as Error).stack ?? err}`);
    await reply('⚠️ Algo salió mal al procesar ese comando. Inténtalo de nuevo.');
  }
}
