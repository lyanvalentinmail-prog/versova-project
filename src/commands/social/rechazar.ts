import { register, type Command } from '../../core/router.js';
import {
  audit,
  findLatestPendingByTarget,
  findPendingByMessage,
  getUser,
  resolveRequest,
  updatePartner,
} from '../../database/repos.js';
import { mention } from '../../messages/design.js';
import * as F from '../../messages/design-extra.js';

const rechazar: Command = {
  name: 'rechazar',
  category: 'Social',
  usage: '.rechazar',
  description: 'Rechaza una propuesta de pareja (o termina tu relación actual).',
  groupOnly: true,
  async run(ctx) {
    const pending = ctx.quotedId
      ? await findPendingByMessage(ctx.groupId, ctx.quotedId)
      : await findLatestPendingByTarget(ctx.groupId, ctx.sender, 'pareja');

    if (pending && pending.status === 'pending' && pending.target_id === ctx.sender) {
      await resolveRequest(pending.id, 'rejected', ctx.sender);
      const from = await getUser(ctx.groupId, pending.user_id);
      await audit(ctx.groupId, ctx.sender, 'rechazar', pending.user_id, { type: 'pareja' });
      await ctx.reply(
        F.parejaRechazada({ from: mention(pending.user_id), to: mention(ctx.sender) }),
        [pending.user_id, ctx.sender],
      );
      if (from) return;
      return;
    }

    const me = await getUser(ctx.groupId, ctx.sender);
    if (!me) return void (await ctx.reply(F.noRegistrado('.rechazar')));
    if (!me.partner_id) return void (await ctx.reply('No tienes ninguna relación ni propuesta pendiente.'));

    const partner = await getUser(ctx.groupId, me.partner_id);
    await updatePartner(ctx.groupId, me.wa_id, null);
    await updatePartner(ctx.groupId, me.partner_id, null);
    await audit(ctx.groupId, ctx.sender, 'rechazar', me.partner_id, { type: 'pareja-terminada' });
    await ctx.reply(
      F.parejaTerminada({ a: mention(me.wa_id), b: mention(me.partner_id) }),
      [me.wa_id, me.partner_id, ...(partner ? [] : [])],
    );
  },
};

register(rechazar);
