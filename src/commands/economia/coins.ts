import { register, type Command } from '../../core/router.js';
import { getBank } from '../../database/repos.js';
import { mention } from '../../messages/design.js';
import * as F from '../../messages/design-extra.js';

const coins: Command = {
  name: 'coins',
  category: 'Economía',
  usage: '.coins [@usuario]',
  description: 'Muestra tus V-Coins (o los de otro integrante).',
  groupOnly: true,
  async run(ctx) {
    const target = ctx.mentions[0] ?? ctx.sender;
    const bank = await getBank(ctx.groupId, target);
    await ctx.reply(F.monedero({ user: mention(target), coins: bank.coins }), [target]);
  },
};

register(coins);
