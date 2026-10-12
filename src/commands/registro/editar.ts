import { register, type Command } from '../../core/router.js';
import { getUser, updateUserProfile } from '../../database/repos.js';
import { parseNameAge } from '../../utils/text.js';
import * as F from '../../messages/design.js';

const editar: Command = {
  name: 'editar',
  category: 'Registro',
  usage: '.editar <nombre.edad>',
  description: 'Cambia tu nombre y edad (no cambia tu personaje).',
  groupOnly: true,
  async run(ctx) {
    const user = await getUser(ctx.groupId, ctx.sender);
    if (!user) return void (await ctx.reply(F.registroRechazado('Regístrate primero con .reg.')));
    const parsed = parseNameAge(ctx.argText);
    if (!parsed.ok) return void (await ctx.reply(F.registroRechazado(parsed.error)));
    await updateUserProfile(ctx.groupId, ctx.sender, parsed.value.name, parsed.value.age);
    await ctx.reply(`✧ Datos actualizados ⁙ *${parsed.value.name}* · ${parsed.value.age} años`);
  },
};

register(editar);
