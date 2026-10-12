import { registerPackCommand, type Command, type Ctx } from '../../../src/core/bot-packs.js';
import { mention } from '../../../src/messages/design.js';
import { logger } from '../../../src/utils/logger.js';
import { userPart } from '../../../src/utils/text.js';
import { formatDate } from '../../../src/utils/time.js';
import { clearPartner, daysTogether, getPartner, setPartner } from '../../shared/social.js';
import { listEntries, readNumber, readText, writeJson } from '../../shared/store.js';
import { YAE, yaeCard, yaeNote } from '../brand.js';

export const PROPOSAL_KEY = 'marry_proposal';
export const PROPOSAL_TTL_MS = 10 * 60 * 1000;

export interface Proposal {
  from: string;
  to: string;
  msgId: string | null;
  at: number;
}

function targetOf(ctx: Ctx): string | null {
  return ctx.mentions.find((jid) => userPart(jid) !== userPart(ctx.sender)) ?? null;
}

/**
 * `.marry` de Yae Miku: la boda necesita confirmación.
 * El mensaje de propuesta se guarda con su id; la guardia `yae-marry` la cierra
 * cuando la otra persona responde «sí» (o la cancela con «no»).
 */
const marry: Command = {
  name: 'marry',
  category: 'Social',
  usage: '.marry <@usuario>',
  description: 'Propone matrimonio; la otra persona acepta respondiendo «sí» al mensaje.',
  groupOnly: true,
  async run(ctx) {
    const target = targetOf(ctx);
    if (!target) {
      await ctx.reply(yaeNote('🎧 Menciona a la persona con la que quieres casarte.'), [ctx.sender]);
      return;
    }
    if (await getPartner(ctx.groupId, ctx.sender)) {
      await ctx.reply(yaeNote('💔 Ya estás casado. Usa `.divorce` primero.'), [ctx.sender]);
      return;
    }
    if (await getPartner(ctx.groupId, target)) {
      await ctx.reply(yaeNote('💔 Esa persona ya tiene pareja.'), [ctx.sender]);
      return;
    }

    const sent = await ctx.reply(
      yaeCard({
        title: 'Propuesta de matrimonio',
        emoji: '💞',
        lines: [
          `${mention(ctx.sender)} le propone matrimonio a ${mention(target)}.`,
          '',
          `${mention(target)}, responde a este mensaje con *sí* para aceptar o *no* para rechazar.`,
          'Tienes 10 minutos. La pareja aparecerá en `.profile`.',
        ],
      }),
      [ctx.sender, target],
    );

    const proposal: Proposal = { from: ctx.sender, to: target, msgId: sent?.key?.id ?? null, at: Date.now() };
    await writeJson(ctx.groupId, target, PROPOSAL_KEY, proposal);
  },
};

/** `.divorce` — disuelve la pareja y deja constancia de los días juntos. */
const divorce: Command = {
  name: 'divorce',
  category: 'Social',
  usage: '.divorce',
  description: 'Termina el matrimonio actual (propio o el de la persona mencionada).',
  groupOnly: true,
  async run(ctx) {
    const mine = await getPartner(ctx.groupId, ctx.sender);
    const target = targetOf(ctx);
    const partner = mine ?? (target ? await getPartner(ctx.groupId, target) : null);
    const owner = mine ? ctx.sender : target;

    if (!partner || !owner) {
      await ctx.reply(yaeNote('🎧 No encontré una pareja para divorciar.'), [ctx.sender]);
      return;
    }

    const days = daysTogether(partner);
    await clearPartner(ctx.groupId, owner, partner.jid);
    await ctx.reply(
      yaeCard({
        title: 'Divorcio',
        emoji: '💔',
        lines: [`${mention(owner)} y ${mention(partner.jid)} ya no están juntos.`, `Duraron ⁙ ${days} días`],
      }),
      [owner, partner.jid],
    );
  },
};

/** `.profile` — ficha social de Yae Miku con la pareja visible. */
const profile: Command = {
  name: 'profile',
  category: 'Social',
  usage: '.profile [@usuario]',
  description: 'Muestra la ficha social: pareja, registro y actividad contada en el grupo.',
  groupOnly: true,
  async run(ctx) {
    const target = targetOf(ctx) ?? ctx.sender;
    const partner = await getPartner(ctx.groupId, target).catch(() => null);
    const messages = await readNumber(ctx.groupId, target, 'yae_msgs').catch((err) => {
      logger.warn('profile', `Sin contador de mensajes: ${(err as Error).message}`);
      return 0;
    });
    const birthday = await readText(ctx.groupId, target, 'birthday').catch(() => null);

    await ctx.reply(
      yaeCard({
        title: 'Ficha social',
        emoji: '🪪',
        lines: [
          `Nombre ⁙ ${mention(target)}${target === ctx.sender ? ' (tú)' : ''}`,
          `Pareja ⁙ ${partner ? `${mention(partner.jid)} · ${daysTogether(partner)} días` : 'sin pareja'}`,
          `Cumpleaños ⁙ ${birthday ?? 'sin datos'}`,
          `Mensajes contados ⁙ ${messages}`,
          `Fecha ⁙ ${formatDate(new Date())}`,
        ],
      }),
      partner ? [target, partner.jid] : [target],
    );
  },
};

/** `.top` — ranking de actividad del grupo (lo alimenta la guardia de actividad). */
const top: Command = {
  name: 'top',
  category: 'Social',
  usage: '.top',
  description: 'Ranking de integrantes por mensajes contados en el grupo.',
  groupOnly: true,
  async run(ctx) {
    const entries = (await listEntries(ctx.groupId, 'yae_msgs'))
      .map((entry) => ({ jid: entry.waId, count: Number(entry.value) || 0 }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    await ctx.reply(
      yaeCard({
        title: 'Ranking del grupo',
        emoji: '📊',
        lines: entries.length
          ? entries.map((entry, index) => `${index + 1}. ${mention(entry.jid)} ⁙ ${entry.count} mensajes`)
          : ['Todavía no hay actividad contada.'],
      }),
      entries.map((entry) => entry.jid),
    );
  },
};

registerPackCommand(YAE.slug, marry, divorce, profile, top);
