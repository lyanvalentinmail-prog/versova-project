import { register, type Command } from '../../core/router.js';
import { audit } from '../../database/repos.js';
import * as F from '../../messages/design.js';
import { mention } from '../../messages/design.js';
import { resolveFromReply } from './shared.js';

const denyrol: Command = {
  name: 'denyrol',
  category: 'Administración',
  usage: '.denyrol (respondiendo a la solicitud)',
  description: 'Rechaza una solicitud de personaje.',
  groupOnly: true,
  adminOnly: true,
  async run(ctx) {
    const result = await resolveFromReply(ctx, 'rejected');
    if (!result) return void (await ctx.reply('Responde al mensaje de la solicitud con .denyrol'));
    if (result.error) return void (await ctx.reply(`⚠️ ${result.error}`));
    const { req, char } = result;
    await audit(ctx.groupId, ctx.sender, 'denyrol', req.user_id, { character: char?.name, type: req.type });
    await ctx.reply(F.solicitudRechazada({ character: char!.name, user: mention(req.user_id) }), [req.user_id]);
  },
};

register(denyrol);
