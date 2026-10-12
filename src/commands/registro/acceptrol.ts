import { register, type Command } from '../../core/router.js';
import { audit } from '../../database/repos.js';
import * as F from '../../messages/design.js';
import { mention } from '../../messages/design.js';
import { resolveFromReply } from './shared.js';

const acceptrol: Command = {
  name: 'acceptrol',
  category: 'Administración',
  usage: '.acceptrol (respondiendo a la solicitud)',
  description: 'Aprueba una solicitud de personaje.',
  groupOnly: true,
  adminOnly: true,
  async run(ctx) {
    const result = await resolveFromReply(ctx, 'approved');
    if (!result) return void (await ctx.reply('Responde al mensaje de la solicitud con .acceptrol'));
    if (result.error) return void (await ctx.reply(`⚠️ ${result.error}`));
    const { req, char } = result;
    await audit(ctx.groupId, ctx.sender, 'acceptrol', req.user_id, { character: char?.name, type: req.type });
    await ctx.reply(F.solicitudAprobada({ character: char!.name, user: mention(req.user_id) }), [req.user_id]);
    await ctx.reply(F.personajeAsignado(char!.name), [req.user_id]);
  },
};

register(acceptrol);
