import { register, type Command } from '../../core/router.js';
import { audit } from '../../database/repos.js';
import { countWarnings, removeLastWarning } from '../../database/warnings.js';
import { mention } from '../../messages/design.js';
import * as F from '../../messages/design-extra.js';

const unwarn: Command = {
  name: 'unwarn',
  category: 'Administración',
  usage: '.unwarn <@usuario>',
  description: 'Retira la advertencia más reciente.',
  groupOnly: true,
  adminOnly: true,
  async run(ctx) {
    const target = ctx.mentions[0];
    if (!target) return void (await ctx.reply(F.faltaObjetivo('.unwarn @usuario')));
    const removed = await removeLastWarning(ctx.groupId, target);
    if (!removed) return void (await ctx.reply(F.noPuedoHacerlo('Ese integrante no tiene advertencias registradas.')));
    const remaining = await countWarnings(ctx.groupId, target);
    await audit(ctx.groupId, ctx.sender, 'unwarn', target, { remaining });
    await ctx.reply(F.advertirQuitada({ user: mention(target), remaining }), [target]);
  },
};

register(unwarn);
