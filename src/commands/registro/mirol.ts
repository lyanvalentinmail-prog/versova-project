import { register, type Command } from '../../core/router.js';
import { getCharacterById, getUser } from '../../database/repos.js';
import * as F from '../../messages/design.js';

const mirol: Command = {
  name: 'mirol',
  category: 'Roles',
  usage: '.mirol',
  description: 'Muestra tu personaje.',
  groupOnly: true,
  async run(ctx) {
    const user = await getUser(ctx.groupId, ctx.sender);
    if (!user) return void (await ctx.reply(F.registroRechazado('Regístrate primero con .reg.')));
    if (!user.character_id) return void (await ctx.reply('No tienes personaje. Pide uno con .rol <personaje>.'));
    const ch = await getCharacterById(user.character_id);
    await ctx.reply(`🥢 Tu personaje ⁙ *${ch?.name ?? '?'}*`);
  },
};

register(mirol);
