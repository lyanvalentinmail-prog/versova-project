import { register, type Command } from '../../core/router.js';
import { getUser, updatePartner } from '../../database/repos.js';
import { mention } from '../../messages/design.js';
import * as F from '../../messages/design-extra.js';
import { userPart } from '../../utils/text.js';

/** Porcentaje estable (mismo par, mismo resultado) derivado de los dos números. */
function compatibility(a: string, b: string): number {
  const key = [userPart(a), userPart(b)].sort().join(':');
  let hash = 0;
  for (const char of key) hash = (hash * 31 + char.charCodeAt(0)) % 100000;
  return 12 + (hash % 89);
}

function verdict(percent: number): string {
  if (percent >= 90) return '¡Almas gemelas! Casen esto ya. (ﾉ´ヮ`)ﾉ*: ･ﾟ';
  if (percent >= 75) return 'Muy buena compatibilidad. Deberían intentarlo. (づ๑•ᴗ•๑)づ♡';
  if (percent >= 55) return 'Hay química, pero necesita trabajo. ( ᵕ ᴗ ᵕ )';
  if (percent >= 35) return 'Mejor queden como amigos. (っ˘ω˘ς)';
  return 'Ship complicado… el destino dice que no. (╥﹏╥)';
}

const ship: Command = {
  name: 'ship',
  category: 'Social',
  usage: '.ship <@usuario> <@usuario>',
  description: 'Calcula la compatibilidad entre dos personas.',
  groupOnly: true,
  async run(ctx) {
    const mentions = ctx.mentions;
    let a = mentions[0];
    let b = mentions[1];
    if (!a || !b) {
      a = a ?? ctx.sender;
      b = b ?? null;
      if (!b) return void (await ctx.reply(F.faltaObjetivo('.ship @usuario @usuario')));
    }
    const percent = compatibility(a, b);
    const [userA, userB] = await Promise.all([getUser(ctx.groupId, a), getUser(ctx.groupId, b)]);
    const nameA = userA?.name ?? mention(a);
    const nameB = userB?.name ?? mention(b);
    await ctx.reply(
      F.shipResult({ a: mention(a), b: mention(b), percent, message: verdict(percent) }) +
        `\n\n${nameA} ♡ ${nameB}`,
      [a, b],
    );

    // Si ambos están libres y el ship supera 90%, quedan en pareja automáticamente.
    if (percent >= 90 && userA && userB && !userA.partner_id && !userB.partner_id) {
      await updatePartner(ctx.groupId, userA.wa_id, userB.wa_id);
      await updatePartner(ctx.groupId, userB.wa_id, userA.wa_id);
      await ctx.reply('💍 El ship fue tan alto que ahora son pareja oficial del team.', [a, b]);
    }
  },
};

register(ship);
