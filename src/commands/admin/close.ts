import { register, type Command } from '../../core/router.js';
import { audit } from '../../database/repos.js';
import * as F from '../../messages/design-extra.js';

const close: Command = {
  name: 'close',
  category: 'Administración',
  usage: '.close',
  description: 'Cierra el grupo para que solo escriban los administradores.',
  groupOnly: true,
  adminOnly: true,
  needsBotAdmin: true,
  async run(ctx) {
    try {
      await ctx.sock.groupSettingUpdate(ctx.chat, 'announcement');
    } catch (err) {
      return void (await ctx.reply(F.noPuedoHacerlo(`No pude cerrar el grupo: ${(err as Error).message}`)));
    }
    await audit(ctx.groupId, ctx.sender, 'close', null, {});
    await ctx.reply(F.grupoEstado({ open: false }));
  },
};

register(close);
