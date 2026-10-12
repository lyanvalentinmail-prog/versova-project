import { register, type Command } from '../../core/router.js';
import { audit, getCharacterById, getUser, setCharacterOwner, setUserCharacter } from '../../database/repos.js';
import { tx } from '../../database/db.js';
import { mention } from '../../messages/design.js';
import { userPart } from '../../utils/text.js';
import { config } from '../../config/index.js';
import { confirmed } from './shared.js';

const resetrol: Command = {
  name: 'resetrol',
  category: 'Administración',
  usage: '.resetrol @usuario',
  description: 'Libera el personaje de otro integrante (sin borrar su registro).',
  groupOnly: true,
  adminOnly: true,
  async run(ctx) {
    const target = ctx.mentions[0];
    if (!target) return void (await ctx.reply('Menciona al integrante. Ejemplo: .resetrol @usuario'));
    const user = await getUser(ctx.groupId, target);
    if (!user) return void (await ctx.reply('Ese usuario no está registrado.'));
    if (!user.character_id) return void (await ctx.reply('Ese usuario no tiene personaje asignado.'));
    const ch = await getCharacterById(user.character_id);
    if (!confirmed(ctx)) {
      return void (await ctx.reply(
        `⚠️ Se liberará *${ch?.name ?? '?'}* de ${mention(target)}.\nPara confirmar escribe *.resetrol @${userPart(target)} ${config.defaults.confirmWord}*`,
        [target],
      ));
    }
    await tx(async (c) => {
      await setCharacterOwner(user.character_id!, null, c);
      await setUserCharacter(ctx.groupId, target, null, c);
    });
    await audit(ctx.groupId, ctx.sender, 'resetrol', target, { character: ch?.name });
    await ctx.reply(`♻️ ${mention(target)} ya no tiene personaje. *${ch?.name ?? '?'}* quedó libre.`, [target]);
  },
};

register(resetrol);
