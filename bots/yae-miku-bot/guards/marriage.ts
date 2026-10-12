import { registerGuard } from '../../../src/core/guards.js';
import type { BotGuard, GuardCtx } from '../../../src/core/bot-packs.js';
import { mention } from '../../../src/messages/design.js';
import { logger } from '../../../src/utils/logger.js';
import { setPartner } from '../../shared/social.js';
import { clearText, readJson } from '../../shared/store.js';
import { PROPOSAL_KEY, PROPOSAL_TTL_MS, type Proposal } from '../commands/social.js';
import { YAE, yaeCard } from '../brand.js';

const YES = /^(s[ií]|si+|claro|acepto|yes|obvio)$/i;
const NO = /^(no|nop|nel|paso|rechazo)$/i;

/**
 * Cierra (o cancela) una propuesta de matrimonio abierta.
 *
 * Se dispara con cada mensaje del grupo: si quien responde es la persona a la que
 * se le propuso y contesta «sí»/«no» citando el mensaje de la propuesta, la pareja
 * queda registrada (o se descarta).
 */
export const marriageGuard: BotGuard = {
  name: 'yae-marry',
  description: 'Confirma las propuestas de matrimonio cuando la otra persona responde sí o no.',
  async run(ctx: GuardCtx) {
    if (!ctx.isGroup) return;
    const proposal = await readJson<Proposal>(ctx.groupId, ctx.sender, PROPOSAL_KEY);
    if (!proposal) return;

    const expired = Date.now() - proposal.at > PROPOSAL_TTL_MS;
    const quoted = ctx.msg.message?.extendedTextMessage?.contextInfo?.stanzaId ?? null;
    const answersToProposal = proposal.msgId ? quoted === proposal.msgId : false;
    const answer = ctx.text.trim();

    if (expired) {
      await clearText(ctx.groupId, ctx.sender, PROPOSAL_KEY);
      await ctx.reply(
        yaeCard({
          title: 'Propuesta vencida',
          emoji: '⌛',
          lines: [`Pasaron más de 10 minutos desde la propuesta de ${mention(proposal.from)}.`, 'Vuelve a pedirlo con `.marry`.'],
        }),
        [ctx.sender],
      );
      return;
    }

    if (!answersToProposal || (!YES.test(answer) && !NO.test(answer))) return;

    await clearText(ctx.groupId, ctx.sender, PROPOSAL_KEY);

    if (NO.test(answer)) {
      await ctx.reply(
        yaeCard({ title: 'Propuesta rechazada', emoji: '💔', lines: [`${mention(proposal.from)} se quedó con el corazón roto.`] }),
        [proposal.from, ctx.sender],
      );
      return;
    }

    try {
      await setPartner(ctx.groupId, proposal.from, ctx.sender);
    } catch (err) {
      logger.warn('yae-marry', `No se pudo guardar la pareja: ${(err as Error).message}`);
      await ctx.reply(`😵 No pude guardar la boda, inténtalo de nuevo.`);
      return;
    }

    await ctx.reply(
      yaeCard({
        title: '¡Boda confirmada!',
        emoji: '💐',
        lines: [
          `${mention(proposal.from)} y ${mention(ctx.sender)} ahora están casados.`,
          'Consulta la pareja con `.profile`.',
        ],
      }),
      [proposal.from, ctx.sender],
    );
  },
};

registerGuard(YAE.slug, marriageGuard);
