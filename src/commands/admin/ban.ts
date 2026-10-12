import { register, type Command } from '../../core/router.js';
import { audit, blockUser, deleteUser, getUser, isBlocked, setCharacterOwner } from '../../database/repos.js';
import { tx } from '../../database/db.js';
import { mention } from '../../messages/design.js';
import * as F from '../../messages/design-extra.js';

const ban: Command = {
  name: 'ban',
  category: 'Administración',
  usage: '.ban <@usuario> [motivo]',
  description: 'Bloquea a un integrante para que el bot no le responda.',
  groupOnly: true,
  adminOnly: true,
  async run(ctx) {
    const target = ctx.mentions[0];
    if (!target) return void (await ctx.reply(F.faltaObjetivo('.ban @usuario <motivo>')));
    const reason = ctx.argText.replace(/@\S+/, '').trim() || 'Sin motivo especificado';
    if (await isBlocked(ctx.groupId, target)) {
      return void (await ctx.reply(F.noPuedoHacerlo('Ese integrante ya está bloqueado.')));
    }

    await blockUser(ctx.groupId, target, reason, ctx.sender);
    const user = await getUser(ctx.groupId, target);
    if (user) {
      await tx(async (c) => {
        if (user.character_id) await setCharacterOwner(user.character_id, null, c);
        await deleteUser(ctx.groupId, target, c);
      });
    }
    await audit(ctx.groupId, ctx.sender, 'ban', target, { reason });
    await ctx.reply(F.accionBan({ user: mention(target), reason, by: mention(ctx.sender) }), [target, ctx.sender]);

    if (ctx.botIsAdmin) {
      await ctx.sock.groupParticipantsUpdate(ctx.chat, [target], 'remove').catch(() => undefined);
    }
  },
};

register(ban);
