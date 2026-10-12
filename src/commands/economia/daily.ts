import { register, type Command } from '../../core/router.js';
import { addBankCoins, getBank, stampBank } from '../../database/repos.js';
import { formatRemaining } from '../../utils/time.js';
import { mention } from '../../messages/design.js';
import * as F from '../../messages/design-extra.js';

const DAY = 24 * 60 * 60 * 1000;

const daily: Command = {
  name: 'daily',
  category: 'Economía',
  usage: '.daily',
  description: 'Reclama tu bono diario de V-Coins.',
  groupOnly: true,
  async run(ctx) {
    const bank = await getBank(ctx.groupId, ctx.sender);
    const last = bank.last_daily_at ? new Date(bank.last_daily_at) : null;
    if (last && Date.now() - last.getTime() < DAY) {
      const next = new Date(last.getTime() + DAY);
      await ctx.reply(F.dailyEspera({ remaining: formatRemaining(next) }), [ctx.sender]);
      return;
    }

    // La racha crece si reclamas dentro de las 48 h siguientes al último cobro.
    const streak = last && Date.now() - last.getTime() < DAY * 2 ? Math.min(30, Math.floor((Date.now() - last.getTime()) / DAY) + 2) : 1;
    const reward = 40 + Math.min(60, streak * 5);
    await stampBank(ctx.groupId, ctx.sender, 'last_daily_at');
    const result = await addBankCoins(ctx.groupId, ctx.sender, reward);
    await ctx.reply(F.dailyCobrado({ user: mention(ctx.sender), reward, total: result.coins, streak }), [ctx.sender]);
  },
};

register(daily);
