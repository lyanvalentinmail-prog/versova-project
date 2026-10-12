import { register, type Command } from '../../core/router.js';
import { getCharacterById, getUser, setCharacterOwner, setUserCharacter } from '../../database/repos.js';
import { tx } from '../../database/db.js';
import * as F from '../../messages/design.js';
import { config } from '../../config/index.js';
import { confirmed } from './shared.js';

const liberar: Command = {
  name: 'liberar',
  category: 'Roles',
  usage: '.liberar',
  description: 'Libera tu propio personaje.',
  groupOnly: true,
  async run(ctx) {
    const user = await getUser(ctx.groupId, ctx.sender);
    if (!user?.character_id) return void (await ctx.reply('No tienes personaje que liberar.'));
    const ch = await getCharacterById(user.character_id);
    if (!confirmed(ctx)) {
      return void (await ctx.reply(
        `⚠️ *Confirmación requerida*\nSe liberará *${ch?.name ?? '?'}* y volverá a estar disponible.\nPara confirmar escribe *.liberar ${config.defaults.confirmWord}*`,
      ));
    }
    await tx(async (c) => {
      await setCharacterOwner(user.character_id!, null, c);
      await setUserCharacter(ctx.groupId, ctx.sender, null, c);
    });
    await ctx.reply(F.liberado({ character: ch?.name ?? '?' }));
  },
};

register(liberar);
