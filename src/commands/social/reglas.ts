import { register, type Command } from '../../core/router.js';
import { audit, getGroupRules, setGroupRules } from '../../database/repos.js';
import * as F from '../../messages/design-extra.js';

const reglas: Command = {
  name: 'reglas',
  category: 'Social',
  usage: '.reglas [set <texto>]',
  description: 'Muestra las reglas del grupo (un admin puede fijarlas).',
  groupOnly: true,
  async run(ctx) {
    const [first, ...rest] = ctx.args;
    const isSet = first?.toLowerCase() === 'set' || first?.toLowerCase() === 'fijar';

    if (isSet) {
      if (!ctx.isAdmin && !ctx.isOwner) return void (await ctx.reply(F.soloAdmins('.reglas set')));
      const text = rest.join(' ').trim();
      if (text.length < 5) return void (await ctx.reply(F.faltaObjetivo('.reglas set <texto de las reglas>')));
      await setGroupRules(ctx.groupId, text.slice(0, 2000));
      await audit(ctx.groupId, ctx.sender, 'reglas', null, { length: text.length });
      await ctx.reply(F.reglasGuardadas());
      return;
    }

    await ctx.reply(F.reglasTexto({ rules: await getGroupRules(ctx.groupId) }));
  },
};

register(reglas);
