import { register, type Command } from '../../core/router.js';
import { audit } from '../../database/repos.js';
import * as F from '../../messages/design-extra.js';

const open: Command = {
  name: 'open',
  category: 'Administración',
  usage: '.open',
  description: 'Abre el grupo para todos los participantes.',
  groupOnly: true,
  adminOnly: true,
  needsBotAdmin: true,
  async run(ctx) {
    try {
      await ctx.sock.groupSettingUpdate(ctx.chat, 'not_announcement');
    } catch (err) {
      return void (await ctx.reply(F.noPuedoHacerlo(`No pude abrir el grupo: ${(err as Error).message}`)));
    }
    await audit(ctx.groupId, ctx.sender, 'open', null, {});
    await ctx.reply(F.grupoEstado({ open: true }));
  },
};

register(open);
