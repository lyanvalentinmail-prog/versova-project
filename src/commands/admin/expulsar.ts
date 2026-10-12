import { register, type Command } from '../../core/router.js';
import { audit, deleteUser, getUser, setCharacterOwner } from '../../database/repos.js';
import { tx } from '../../database/db.js';
import { expulsion, mention } from '../../messages/design.js';
import * as F from '../../messages/design-extra.js';

const expulsar: Command = {
  name: 'expulsar',
  category: 'Administración',
  usage: '.expulsar <@usuario> [motivo]',
  description: 'Expulsa a un integrante del grupo.',
  groupOnly: true,
  adminOnly: true,
  needsBotAdmin: true,
  async run(ctx) {
    const target = ctx.mentions[0];
    if (!target) return void (await ctx.reply(F.faltaObjetivo('.expulsar @usuario <motivo>')));
    const reason = ctx.argText.replace(/@\S+/, '').trim() || 'Sin motivo especificado';

    try {
      await ctx.sock.groupParticipantsUpdate(ctx.chat, [target], 'remove');
    } catch (err) {
      return void (await ctx.reply(F.noPuedoHacerlo(`No pude expulsar a ese integrante: ${(err as Error).message}`)));
    }

    const user = await getUser(ctx.groupId, target);
    if (user) {
      await tx(async (c) => {
        if (user.character_id) await setCharacterOwner(user.character_id, null, c);
        await deleteUser(ctx.groupId, target, c);
      });
    }
    await audit(ctx.groupId, ctx.sender, 'expulsar', target, { reason, hadUser: Boolean(user) });
    await ctx.reply(expulsion({ user: mention(target), reason }), [target]);
  },
};

register(expulsar);
