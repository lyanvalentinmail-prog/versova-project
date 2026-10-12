import { register, type Command } from '../../core/router.js';
import { getUser, insertUser } from '../../database/repos.js';
import { parseNameAge, maskPhone } from '../../utils/text.js';
import * as F from '../../messages/design.js';

const reg: Command = {
  name: 'reg',
  category: 'Registro',
  usage: '.reg <nombre.edad>',
  description: 'Registra tu cuenta en el team.',
  groupOnly: true,
  async run(ctx) {
    const parsed = parseNameAge(ctx.argText);
    if (!parsed.ok) return void (await ctx.reply(F.registroRechazado(parsed.error)));
    const { name, age } = parsed.value;

    if (await getUser(ctx.groupId, ctx.sender)) {
      return void (await ctx.reply(F.registroRechazado('Ya estás registrado. Usa .editar para cambiar tus datos.')));
    }
    try {
      await insertUser(ctx.groupId, ctx.sender, name, age);
    } catch (err) {
      if ((err as { code?: string }).code === '23505') {
        return void (await ctx.reply(F.registroRechazado('Ya existe un registro con tu número.')));
      }
      throw err;
    }
    await ctx.reply(F.registroExitoso({ name, age, phone: maskPhone(ctx.sender) }));
  },
};

register(reg);
