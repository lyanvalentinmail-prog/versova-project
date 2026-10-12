import { register, type Command } from '../../core/router.js';
import { getUser } from '../../database/repos.js';
import { unregisterMember } from '../../services/registry.js';
import { config } from '../../config/index.js';
import * as F from '../../messages/design.js';
import { confirmed } from './shared.js';

const unreg: Command = {
  name: 'unreg',
  category: 'Registro',
  usage: '.unreg',
  description: 'Elimina tu registro y libera tu personaje.',
  groupOnly: true,
  async run(ctx) {
    const user = await getUser(ctx.groupId, ctx.sender);
    if (!user) return void (await ctx.reply(F.registroRechazado('No estás registrado.')));
    if (!confirmed(ctx)) {
      return void (await ctx.reply(
        `⚠️ *Confirmación requerida*\nSe eliminará tu registro, se liberará tu personaje y se cancelarán tus reservas.\nPara confirmar escribe *.unreg ${config.defaults.confirmWord}*`,
      ));
    }
    await unregisterMember(ctx.groupId, ctx.sender);
    await ctx.reply(`🗑️ Registro eliminado. Tu personaje quedó liberado.`);
  },
};

register(unreg);
