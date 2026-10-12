import { registerPackCommand, type Command, type Ctx } from '../../../src/core/bot-packs.js';
import { mention } from '../../../src/messages/design.js';
import { userPart } from '../../../src/utils/text.js';
import { formatDate } from '../../../src/utils/time.js';
import { clearPartner, daysTogether, getPartner, setPartner } from '../../shared/social.js';
import { cooldownLeft, listEntries, markUsed, readNumber, bumpNumber, readText, writeText } from '../../shared/store.js';
import { humanDuration, joinArgs } from '../../shared/text.js';
import { RAIDEN, raidenCard, raidenNote } from '../brand.js';

const WORK_COOLDOWN_MS = 30 * 60 * 1000;
const WORK_KEY = 'raiden_work';

function targetOf(ctx: Ctx): string | null {
  return ctx.mentions.find((jid) => userPart(jid) !== userPart(ctx.sender)) ?? null;
}

/** `.marry` — matrimonio instantáneo con la pareja visible en el perfil. */
const marry: Command = {
  name: 'marry',
  category: 'Social',
  usage: '.marry <@usuario>',
  description: 'Propone matrimonio y sella la promesa con la persona mencionada.',
  groupOnly: true,
  async run(ctx) {
    const target = targetOf(ctx);
    if (!target) {
      await ctx.reply(raidenNote('⚡ Menciona a la persona con la que quieres casarte.'), [ctx.sender]);
      return;
    }
    if (await getPartner(ctx.groupId, target)) {
      await ctx.reply(raidenNote('💔 Esa persona ya está casada. Prueba con `.divorce` 👀'), [ctx.sender]);
      return;
    }
    const mine = await getPartner(ctx.groupId, ctx.sender);
    if (mine) {
      await ctx.reply(raidenNote('💍 Ya estás casado. Primero `.divorce`.'), [ctx.sender]);
      return;
    }

    await setPartner(ctx.groupId, ctx.sender, target);
    await ctx.reply(
      raidenCard({
        title: 'Nueva pareja',
        emoji: '💍',
        lines: [
          `${mention(ctx.sender)} y ${mention(target)} ahora están casados.`,
          `Fecha ⁙ ${formatDate(new Date())}`,
          'Mira la pareja en el perfil con `.perfil`.',
        ],
      }),
      [ctx.sender, target],
    );
  },
};

const divorce: Command = {
  name: 'divorce',
  category: 'Social',
  usage: '.divorce',
  description: 'Rompe el matrimonio actual.',
  groupOnly: true,
  async run(ctx) {
    const partner = await getPartner(ctx.groupId, ctx.sender);
    if (!partner) {
      await ctx.reply(raidenNote('⚡ No tienes pareja con la que divorciarte.'), [ctx.sender]);
      return;
    }
    const days = daysTogether(partner);
    await clearPartner(ctx.groupId, ctx.sender, partner.jid);
    await ctx.reply(
      raidenCard({
        title: 'Divorcio',
        emoji: '💔',
        lines: [
          `${mention(ctx.sender)} rompió con ${mention(partner.jid)}.`,
          `Días juntos ⁙ ${days}`,
        ],
      }),
      [ctx.sender, partner.jid],
    );
  },
};

/** `.work` — turno de trabajo con recompensa de puntos y ranking (`.top`). */
const work: Command = {
  name: 'work',
  category: 'Economía',
  usage: '.work',
  description: 'Trabaja un turno para ganar puntos de Raiden (cada 30 minutos).',
  async run(ctx) {
    const left = await cooldownLeft(ctx.groupId || ctx.chat, ctx.sender, `${WORK_KEY}_at`, WORK_COOLDOWN_MS);
    if (left > 0) {
      await ctx.reply(raidenNote(`😮‍💨 Descansa un poco. Vuelve en ${humanDuration(left * 1000)}.`), [ctx.sender]);
      return;
    }
    const seed = Date.now() / 1000;
    const gain = 30 + Math.floor((seed % 41));
    await markUsed(ctx.groupId || ctx.chat, ctx.sender, `${WORK_KEY}_at`);
    const total = await bumpNumber(ctx.groupId || ctx.chat, ctx.sender, WORK_KEY, gain);

    await ctx.reply(
      raidenCard({
        title: 'Turno completado',
        emoji: '🛠️',
        lines: [
          `${mention(ctx.sender)} trabajó en la Comisión de Narukami.`,
          `Ganancia ⁙ +${gain} puntos`,
          `Total ⁙ ${total} puntos`,
        ],
      }),
      [ctx.sender],
    );
  },
};

/** `.top` — ranking del grupo por puntos de trabajo. */
const top: Command = {
  name: 'top',
  category: 'Economía',
  usage: '.top',
  description: 'Ranking de puntos de trabajo del grupo.',
  groupOnly: true,
  async run(ctx) {
    const entries = (await listEntries(ctx.groupId, WORK_KEY))
      .map((entry) => ({ jid: entry.waId, points: Number(entry.value) || 0 }))
      .filter((entry) => entry.points > 0)
      .sort((a, b) => b.points - a.points)
      .slice(0, 10);

    if (!entries.length) {
      await ctx.reply(raidenNote('⚡ Todavía nadie trabajó en este grupo. Usa `.work`'), [ctx.sender]);
      return;
    }

    const medals = ['🥇', '🥈', '🥉'];
    await ctx.reply(
      raidenCard({
        title: 'Ranking del grupo',
        emoji: '🏆',
        lines: entries.map((entry, index) =>
          `${medals[index] ?? `ㅤ${index + 1}.`} ${mention(entry.jid)} ⁙ ${entry.points} puntos`,
        ),
      }),
      entries.map((entry) => entry.jid),
    );
  },
};

/** `.cumple <DD/MM>` — cumpleaños guardado por integrante. */
const birthday: Command = {
  name: 'cumple',
  category: 'Social',
  usage: '.cumple [DD/MM]',
  description: 'Guarda o consulta tu cumpleaños.',
  groupOnly: true,
  async run(ctx) {
    const raw = joinArgs(ctx.args);
    const stored = await readText(ctx.groupId, ctx.sender, 'birthday');

    if (!raw) {
      const others = (await listEntries(ctx.groupId, 'birthday')).slice(0, 8);
      await ctx.reply(
        raidenCard({
          title: 'Cumpleaños',
          emoji: '🎂',
          lines: [
            stored ? `Tu cumpleaños ⁙ ${stored}` : 'Todavía no guardaste tu cumpleaños.',
            'Uso ⁙ `.cumple 24/07`',
            '',
            ...others.map((entry) => `${mention(entry.waId)} ⁙ ${entry.value}`),
          ],
        }),
        [ctx.sender, ...others.map((entry) => entry.waId)],
      );
      return;
    }

    const match = raw.match(/^(\d{1,2})\/(\d{1,2})$/);
    const day = Number(match?.[1] ?? 0);
    const month = Number(match?.[2] ?? 0);
    if (!match || day < 1 || day > 31 || month < 1 || month > 12) {
      await ctx.reply(raidenNote('⚡ Usa el formato día/mes, por ejemplo `.cumple 24/07`.'), [ctx.sender]);
      return;
    }

    const value = `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}`;
    await writeText(ctx.groupId, ctx.sender, 'birthday', value);
    await ctx.reply(raidenNote(`🎂 Guardado: ${mention(ctx.sender)} cumple el ${value}.`), [ctx.sender]);
  },
};

registerPackCommand(RAIDEN.slug, marry, divorce, work, top, birthday);
