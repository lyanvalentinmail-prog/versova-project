import { register, type Command } from '../../core/router.js';
import { audit, isBlocked, unblockUser } from '../../database/repos.js';
import { mention } from '../../messages/design.js';
import * as F from '../../messages/design-extra.js';

const unban: Command = {
  name: 'unban',
  category: 'Administración',
  usage: '.unban <@usuario>',
  description: 'Retira el bloqueo de un integrante.',
  groupOnly: true,
  adminOnly: true,
  async run(ctx) {
    const target = ctx.mentions[0];
    if (!target) return void (await ctx.reply(F.faltaObjetivo('.unban @usuario')));
    if (!(await isBlocked(ctx.groupId, target))) {
      return void (await ctx.reply(F.sinBloqueo({ user: mention(target) }), [target]));
    }
    await unblockUser(ctx.groupId, target);
    await audit(ctx.groupId, ctx.sender, 'unban', target, {});
    await ctx.reply(F.accionUnban({ user: mention(target) }), [target]);
  },
};

register(unban);
