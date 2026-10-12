import { registerPackCommand, type Command, type Ctx } from '../../../src/core/bot-packs.js';
import { mention } from '../../../src/messages/design.js';
import { userPart } from '../../../src/utils/text.js';
import { cleanText, joinArgs } from '../../shared/text.js';
import { REACTIONS, REACTION_INDEX, type ReactionDef } from '../lib/reactions.js';
import { RAIDEN, raidenCard, raidenNote } from '../brand.js';

/** A quién va dirigida la reacción: la mención, el citado o (si no hay nadie) el autor. */
function targetOf(ctx: Ctx): string | null {
  const mentioned = ctx.mentions.find((jid) => userPart(jid) !== userPart(ctx.sender));
  if (mentioned) return mentioned;
  const quotedSender = ctx.msg.message?.extendedTextMessage?.contextInfo?.participant;
  if (quotedSender) return quotedSender;
  return null;
}

function renderText(reaction: ReactionDef, ctx: Ctx, target: string): string {
  const a = mention(ctx.sender);
  const b = mention(target);
  const action = reaction.text.replace('{a}', a).replace('{b}', b);
  return [`ㅤ${reaction.emoji}ㅤ${action}`, '', `ㅤ⌞ㅤ${RAIDEN.brand}`].join('\n');
}

function reactionCommand(reaction: ReactionDef): Command {
  return {
    name: reaction.name,
    category: 'Reacciones',
    usage: `.${reaction.name} <@usuario>`,
    description: `Reacción anime: ${reaction.text.replace('{a}', 'tú').replace('{b}', 'la otra persona')}.`,
    async run(ctx) {
      const target = targetOf(ctx);
      if (!target) {
        await ctx.reply(
          raidenNote(`${reaction.emoji} Menciona a alguien o responde a su mensaje para usar .${reaction.name}`),
          [ctx.sender],
        );
        return;
      }
      if (userPart(target) === userPart(ctx.sender)) {
        await ctx.reply(raidenNote(`${reaction.emoji} ¿Contigo mismo? Busca a otra persona 👀`), [ctx.sender]);
        return;
      }
      await ctx.reply(renderText(reaction, ctx, target), [ctx.sender, target]);
    },
  };
}

/** `.reaccion <tipo> @alguien` — misma acción eligiendo el tipo desde el argumento. */
const reactionAny: Command = {
  name: 'reaccion',
  category: 'Reacciones',
  usage: '.reaccion <tipo> <@usuario>',
  description: 'Hace una reacción anime indicando el tipo (`.reaccion hug @Ana`).',
  async run(ctx) {
    const type = (ctx.args[0] ?? '').toLowerCase();
    const target = targetOf(ctx);

    if (!type) {
      await ctx.reply(raidenCard({
        title: 'Reacciones anime',
        emoji: '💞',
        lines: [
          `Disponibles ⁙ ${REACTIONS.length}`,
          'Uso ⁙ `.reaccion hug @Ana`',
          `Lista ⁙ \`.reacciones\``,
        ],
      }));
      return;
    }

    const reaction = REACTION_INDEX.get(type);
    if (!reaction) {
      await ctx.reply(raidenNote(`⚡ No conozco la reacción «${type}». Mira la lista con .reacciones`), [ctx.sender]);
      return;
    }
    if (!target) {
      await ctx.reply(raidenNote(`${reaction.emoji} Menciona a alguien para la reacción .${type}`), [ctx.sender]);
      return;
    }

    const rewritten: Ctx = { ...ctx, mentions: [target] };
    await ctx.reply(renderText(reaction, rewritten, target), [ctx.sender, target]);
  },
};

/** `.reacciones` — lista completa agrupada en columnas. */
const reactionList: Command = {
  name: 'reacciones',
  category: 'Reacciones',
  usage: '.reacciones [filtro]',
  description: 'Lista todas las reacciones anime disponibles.',
  async run(ctx) {
    const filter = cleanText(joinArgs(ctx.args), 30).toLowerCase();
    const list = filter ? REACTIONS.filter((entry) => entry.name.includes(filter) || entry.text.includes(filter)) : REACTIONS;
    const columns = list.map((entry) => `${entry.emoji} .${entry.name}`);

    await ctx.reply(raidenCard({
      title: filter ? `Reacciones «${filter}»` : 'Reacciones anime',
      emoji: '🎴',
      lines: [
        `Total ⁙ ${list.length} de ${REACTIONS.length}`,
        '',
        ...columns,
      ],
    }));
  },
};

registerPackCommand(RAIDEN.slug, reactionAny, reactionList, ...REACTIONS.map(reactionCommand));
