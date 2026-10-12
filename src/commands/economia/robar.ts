import { register, type Command } from '../../core/router.js';
import { addBankCoins, getBank, stampBank } from '../../database/repos.js';
import { formatRemaining } from '../../utils/time.js';
import { mention } from '../../messages/design.js';
import * as F from '../../messages/design-extra.js';

const COOLDOWN = 30 * 60 * 1000;

const robar: Command = {
  name: 'robar',
  category: 'Economía',
  usage: '.robar <@usuario>',
  description: 'Intenta robar V-Coins a otro integrante.',
  groupOnly: true,
  async run(ctx) {
    const target = ctx.mentions[0];
    if (!target) return void (await ctx.reply(F.faltaObjetivo('.robar @usuario')));
    if (target === ctx.sender) return void (await ctx.reply('Robarte a ti mismo no cuenta. (・_・;)'));

    const mine = await getBank(ctx.groupId, ctx.sender);
    const last = mine.last_rob_at ? new Date(mine.last_rob_at) : null;
    if (last && Date.now() - last.getTime() < COOLDOWN) {
      return void (await ctx.reply(F.trabajoEspera({ remaining: formatRemaining(new Date(last.getTime() + COOLDOWN)) }), [ctx.sender]));
    }
    await stampBank(ctx.groupId, ctx.sender, 'last_rob_at');

    const victim = await getBank(ctx.groupId, target);
    if (victim.coins < 50) {
      return void (await ctx.reply(F.noPuedoHacerlo('Esa persona no tiene suficientes monedas para robarle.'), [target]));
    }

    const success = Math.random() < 0.45;
    if (success) {
      const amount = Math.max(10, Math.floor(victim.coins * (0.1 + Math.random() * 0.2)));
      await addBankCoins(ctx.groupId, target, -amount);
      const result = await addBankCoins(ctx.groupId, ctx.sender, amount);
      await ctx.reply(
        F.roboExitoso({ robber: mention(ctx.sender), victim: mention(target), amount, total: result.coins }),
        [ctx.sender, target],
      );
      return;
    }

    const fine = Math.min(mine.coins, 25 + Math.floor(Math.random() * 40));
    const result = await addBankCoins(ctx.groupId, ctx.sender, -fine);
    await ctx.reply(
      F.roboFallido({ robber: mention(ctx.sender), victim: mention(target), multa: fine }) +
        `\nㅤSaldo ⁙ ${result.coins} V-Coins`,
      [ctx.sender, target],
    );
  },
};

register(robar);
