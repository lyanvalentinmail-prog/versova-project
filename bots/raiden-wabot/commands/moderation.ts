import { registerPackCommand, type Command } from '../../../src/core/bot-packs.js';
import { logger } from '../../../src/utils/logger.js';
import { userPart } from '../../../src/utils/text.js';
import {
  ANTILINK_WARN_LIMIT,
  getAntilink,
  setAntilink,
  setMuted,
  type AntilinkAction,
} from '../../shared/antilink.js';
import { RAIDEN, raidenCard, raidenNote } from '../brand.js';

const antilink: Command = {
  name: 'antilink',
  category: 'Moderación',
  usage: '.antilink <on|off|warn|delete|kick|status>',
  description: 'Activa o configura el borrado automático de enlaces.',
  groupOnly: true,
  adminOnly: true,
  async run(ctx) {
    const option = (ctx.args[0] ?? 'status').toLowerCase();
    const current = await getAntilink(ctx.groupId);

    if (['status', 'estado'].includes(option)) {
      await ctx.reply(raidenCard({
        title: 'Antilink',
        emoji: '🔗',
        lines: [
          `Estado ⁙ ${current.enabled ? 'activado' : 'desactivado'}`,
          `Acción ⁙ ${current.action}`,
          `Avisos antes de expulsar ⁙ ${ANTILINK_WARN_LIMIT} (acción warn)`,
          'Uso ⁙ `.antilink on` · `.antilink kick` · `.antilink off`',
        ],
      }));
      return;
    }

    if (['off', 'no', 'desactivar'].includes(option)) {
      await setAntilink(ctx.groupId, { ...current, enabled: false });
      await ctx.reply(raidenNote('🔓 Antilink desactivado en este grupo.'));
      return;
    }

    if (['on', 'si', 'sí', 'activar', 'warn', 'delete', 'kick'].includes(option)) {
      const action: AntilinkAction = ['warn', 'delete', 'kick'].includes(option)
        ? (option as AntilinkAction)
        : current.action === 'delete'
          ? 'delete'
          : 'warn';
      await setAntilink(ctx.groupId, { enabled: true, action });
      await ctx.reply(raidenCard({
        title: 'Antilink activado',
        emoji: '🔒',
        lines: [
          `Acción ⁙ ${action}`,
          action === 'kick' ? 'Quien envíe un enlace será expulsado.' : action === 'warn' ? `Tres avisos y expulsión.` : 'Solo se borra el enlace.',
          'Necesito ser administrador para borrar y expulsar.',
        ],
      }));
      return;
    }

    await ctx.reply(raidenNote('⚡ Opciones: `.antilink on|off|warn|delete|kick|status`'));
  },
};

const mute: Command = {
  name: 'mute',
  category: 'Moderación',
  usage: '.mute [minutos]',
  description: 'Silencia el grupo: solo hablan los administradores.',
  groupOnly: true,
  adminOnly: true,
  needsBotAdmin: true,
  async run(ctx) {
    await setMuted(ctx.groupId, true);
    const minutes = Number(ctx.args[0]);
    const extra = Number.isFinite(minutes) && minutes > 0 ? ` durante ${minutes} min (quita el mute a mano con \`.unmute\`)` : '';
    await ctx.reply(raidenNote(`🔇 Grupo silenciado${extra}. Solo administradores y el owner pueden escribir.`));
  },
};

const unmute: Command = {
  name: 'unmute',
  category: 'Moderación',
  usage: '.unmute',
  description: 'Devuelve la voz al grupo.',
  groupOnly: true,
  adminOnly: true,
  async run(ctx) {
    await setMuted(ctx.groupId, false);
    await ctx.reply(raidenNote('🔊 Grupo desbloqueado, ya pueden escribir todos.'));
  },
};

const tagall: Command = {
  name: 'tagall',
  category: 'Moderación',
  usage: '.tagall [mensaje]',
  description: 'Menciona a todos los integrantes del grupo.',
  groupOnly: true,
  adminOnly: true,
  async run(ctx) {
    const participants = (ctx.meta?.participants ?? []).map((p) => p.id).filter(Boolean);
    if (!participants.length) {
      await ctx.reply(raidenNote('No pude leer la lista de integrantes.'));
      return;
    }
    const note = ctx.argText.trim() || 'Aviso del equipo';
    const mentions = participants.map((jid) => `@${userPart(jid)}`);
    const chunks: string[] = [];
    for (let index = 0; index < mentions.length; index += 12) {
      chunks.push(mentions.slice(index, index + 12).join(' '));
    }

    try {
      await ctx.sock.sendMessage(ctx.chat, {
        text: raidenCard({
          title: note,
          emoji: '📣',
          lines: [`Integrantes ⁙ ${participants.length}`, '', ...chunks],
        }),
        mentions: participants,
      });
    } catch (err) {
      logger.warn('tagall', `No se pudo mencionar a todos: ${(err as Error).message}`);
      await ctx.reply(raidenNote('⚠️ WhatsApp no me dejó enviar las menciones.'));
    }
  },
};

registerPackCommand(RAIDEN.slug, antilink, mute, unmute, tagall);
