import { registerPackCommand, type Command, type Ctx } from '../../../src/core/bot-packs.js';
import { mention } from '../../../src/messages/design.js';
import { logger } from '../../../src/utils/logger.js';
import { userPart } from '../../../src/utils/text.js';
import { formatDate } from '../../../src/utils/time.js';
import { daysTogether, getPartner } from '../../shared/social.js';
import { readText } from '../../shared/store.js';
import { RAIDEN, raidenCard, raidenNote } from '../brand.js';

function targetOf(ctx: Ctx): string {
  return ctx.mentions.find((jid) => userPart(jid) !== userPart(ctx.sender)) ?? ctx.sender;
}

/** `.foto` — foto de perfil pública del integrante. */
const photo: Command = {
  name: 'foto',
  category: 'Social',
  usage: '.foto [@usuario]',
  description: 'Muestra la foto de perfil de alguien del grupo.',
  groupOnly: true,
  async run(ctx) {
    const target = targetOf(ctx);
    try {
      const url = await ctx.sock.profilePictureUrl(target, 'image');
      if (!url) throw new Error('sin foto');
      await ctx.sock.sendMessage(
        ctx.chat,
        { image: { url }, caption: raidenNote(`📸 ${mention(target)}`) },
        { quoted: ctx.msg },
      );
    } catch {
      await ctx.reply(raidenNote(`⚡ ${mention(target)} no tiene foto de perfil visible.`), [target]);
    }
  },
};

/**
 * `.perfil` de Raiden: versión social (pareja, cumpleaños, puntos) del perfil.
 * Reemplaza al comando del núcleo solo cuando Raiden WaBot está activo.
 */
const profile: Command = {
  name: 'perfil',
  category: 'Social',
  usage: '.perfil [@usuario]',
  description: 'Perfil social de Raiden: pareja, cumpleaños y puntos de trabajo.',
  groupOnly: true,
  async run(ctx) {
    const target = targetOf(ctx);
    const partner = await getPartner(ctx.groupId, target).catch((err) => {
      logger.warn('perfil', `Sin datos de pareja: ${(err as Error).message}`);
      return null;
    });
    const birthday = await readText(ctx.groupId, target, 'birthday').catch(() => null);

    await ctx.reply(
      raidenCard({
        title: 'Perfil',
        emoji: '🪪',
        lines: [
          `Nombre ⁙ ${mention(target)}${target === ctx.sender ? ' (tú)' : ''}`,
          `Pareja ⁙ ${partner ? `${mention(partner.jid)} · ${daysTogether(partner)} días` : 'sin pareja'}`,
          `Cumpleaños ⁙ ${birthday ?? 'sin datos'}`,
          `Registro ⁙ ${formatDate(new Date())}`,
        ],
      }),
      partner ? [target, partner.jid] : [target],
    );
  },
};

registerPackCommand(RAIDEN.slug, photo, profile);
