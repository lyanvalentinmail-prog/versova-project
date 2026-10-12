import { register, type Command } from '../../core/router.js';
import { audit } from '../../database/repos.js';
import { addWarning, countWarnings } from '../../database/warnings.js';
import { config } from '../../config/index.js';
import { advertencia, expulsion, mention } from '../../messages/design.js';
import * as F from '../../messages/design-extra.js';

const warn: Command = {
  name: 'warn',
  category: 'Administración',
  usage: '.warn <@usuario> [motivo]',
  description: 'Añade una advertencia (expulsa al llegar al límite).',
  groupOnly: true,
  adminOnly: true,
  needsBotAdmin: false,
  async run(ctx) {
    const target = ctx.mentions[0];
    if (!target) return void (await ctx.reply(F.faltaObjetivo('.warn @usuario <motivo>')));
    const reason = ctx.mentions.length
      ? ctx.argText.split(/\s+/).slice(1).join(' ').trim() || 'Sin motivo especificado'
      : ctx.argText.replace(/@\S+/, '').trim() || 'Sin motivo especificado';

    const count = await addWarning(ctx.groupId, target, reason, ctx.sender);
    await audit(ctx.groupId, ctx.sender, 'warn', target, { reason, count });
    await ctx.reply(advertencia({ user: mention(target), reason, count, limit: config.defaults.warnLimit }), [target]);

    if (count >= config.defaults.warnLimit) {
      if (!ctx.botIsAdmin) {
        await ctx.reply(F.noPuedoHacerlo(`Llegó a ${config.defaults.warnLimit} advertencias, pero no soy administrador del grupo.`));
        return;
      }
      try {
        await ctx.sock.groupParticipantsUpdate(ctx.chat, [target], 'remove');
        await audit(ctx.groupId, ctx.sender, 'warn-expulsion', target, { count });
        await ctx.reply(expulsion({ user: mention(target), reason: `Acumuló ${count} advertencias` }), [target]);
      } catch (err) {
        await ctx.reply(F.noPuedoHacerlo(`No pude expulsar a @${target.split('@')[0]}: ${(err as Error).message}`));
      }
    }
  },
};

register(warn);
