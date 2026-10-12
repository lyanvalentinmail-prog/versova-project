import type { WAMessage, WASocket } from '@whiskeysockets/baileys';
import { handleCommand, extractText } from '../core/router.js';
import { getActiveBotSlug } from '../core/active-bot.js';
import { runGuards } from '../core/guards.js';
import { botIsAdmin, getGroupMeta, isAdminIn, isOwner } from '../core/permissions.js';
import type { GuardCtx } from '../core/bot-packs.js';
import { clearAfk, getMember, touchMember } from '../database/repos.js';
import * as F from '../messages/design.js';
import { mention } from '../messages/design.js';
import { normalizeJid, userPart } from '../utils/text.js';
import { contextMentions } from './helpers.js';
import { logger } from '../utils/logger.js';

/**
 * Contexto mínimo que reciben las guardias de los bots del catálogo.
 * Se construye solo cuando hay mensaje de texto: una guardia nunca analiza media.
 */
async function guardContext(
  sock: WASocket,
  msg: WAMessage,
  text: string,
  sender: string,
  chat: string,
): Promise<GuardCtx> {
  const meta = await getGroupMeta(sock, chat).catch(() => null);
  const admin = meta ? isAdminIn(meta, sender) : false;
  const botAdmin = meta ? botIsAdmin(meta, sock) : false;
  return {
    sock,
    msg,
    chat,
    isGroup: true,
    groupId: chat,
    sender,
    senderName: msg.pushName ?? '',
    text,
    mentions: contextMentions(msg),
    isAdmin: admin,
    botIsAdmin: botAdmin,
    isOwner: isOwner(sender),
    pack: getActiveBotSlug(),
    reply: async (body, mentions) => {
      try {
        return await sock.sendMessage(chat, { text: body, mentions: mentions ?? [] }, { quoted: msg });
      } catch (err) {
        logger.error('send', `No se pudo enviar mensaje: ${(err as Error).message}`);
        return undefined;
      }
    },
  };
}

/** Punto de entrada de cada mensaje entrante. */
export async function onMessagesUpsert(sock: WASocket, msg: WAMessage): Promise<void> {
  const chat = msg.key.remoteJid;
  if (!chat || !msg.message) return;

  if (!chat.endsWith('@g.us')) {
    // En privado solo se atienden comandos.
    await handleCommand(sock, msg);
    return;
  }
  if (msg.key.fromMe) {
    await handleCommand(sock, msg);
    return;
  }
  // El bot que está activo decide qué guardias corren (antilink, mute, contadores…).
  const pack = getActiveBotSlug();

  const sender = msg.key.participant ? normalizeJid(msg.key.participant) : null;
  if (!sender) return;
  const text = extractText(msg).trim();
  const isAfkCommand = /^\.afk(\s|$)/i.test(text);

  // 1) Actividad: registrar última vez que habló.
  const member = await touchMember(chat, sender, msg.pushName ?? '');

  // 2) Si estaba AFK y envía un mensaje normal, se quita el AFK.
  if (member.afk_since && !isAfkCommand) {
    await clearAfk(chat, sender);
    await sock.sendMessage(chat, { text: F.afkOff({ user: mention(sender) }), mentions: [sender] }).catch(() => undefined);
  }

  // 3) Menciones a usuarios AFK.
  const mentioned = contextMentions(msg).filter((jid) => userPart(jid) !== userPart(sender));
  for (const jid of mentioned) {
    const target = await getMember(chat, jid);
    if (target?.afk_since) {
      await sock
        .sendMessage(chat, {
          text: F.afkMentioned({
            user: mention(jid),
            reason: target.afk_reason ?? 'Sin motivo',
            since: target.afk_since,
          }),
          mentions: [jid],
        })
        .catch((err) => logger.warn('afk', `No se pudo avisar AFK: ${(err as Error).message}`));
    }
  }

  // 4) Guardias del pack activo: antilink, mute y contadores. Nunca interrumpen.
  await runGuards(pack, await guardContext(sock, msg, text, sender, chat), (err, guard) =>
    logger.warn('guardia', `${guard.name} falló: ${(err as Error).message}`),
  );

  // 5) Comandos.
  await handleCommand(sock, msg);
}
