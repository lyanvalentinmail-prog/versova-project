import { register, type Command } from '../../core/router.js';
import { clearAfk, getMember, setAfk, touchMember } from '../../database/repos.js';
import { mention } from '../../messages/design.js';
import * as F from '../../messages/design.js';

const afk: Command = {
  name: 'afk',
  category: 'Equipo',
  usage: '.afk <motivo>',
  description: 'Activa tu estado de ausencia (se quita al escribir de nuevo).',
  groupOnly: true,
  async run(ctx) {
    const reason = ctx.argText.trim().slice(0, 120);
    await touchMember(ctx.groupId, ctx.sender, ctx.senderName);
    const member = await getMember(ctx.groupId, ctx.sender);

    if (!reason || reason.toLowerCase() === 'off') {
      if (member?.afk_since) await clearAfk(ctx.groupId, ctx.sender);
      await ctx.reply(F.afkOff({ user: mention(ctx.sender) }), [ctx.sender]);
      return;
    }

    await setAfk(ctx.groupId, ctx.sender, reason);
    await ctx.reply(F.afkOn({ user: mention(ctx.sender), reason }), [ctx.sender]);
  },
};

register(afk);
