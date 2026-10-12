import { register, type Command } from '../../core/router.js';
import { addBankCoins, getBank, stampBank } from '../../database/repos.js';
import { formatRemaining } from '../../utils/time.js';
import { mention } from '../../messages/design.js';
import * as F from '../../messages/design-extra.js';

const JOBS = [
  ['repartidor', 30],
  ['barista', 45],
  ['programador', 80],
  ['moderador de rol', 60],
  ['streamer', 95],
  ['profesor', 70],
  ['diseñador', 85],
  ['cocinero', 50],
] as const;

const COOLDOWN = 15 * 60 * 1000;

const work: Command = {
  name: 'work',
  category: 'Economía',
  usage: '.work',
  description: 'Trabaja para ganar V-Coins (cada 15 minutos).',
  groupOnly: true,
  async run(ctx) {
    const bank = await getBank(ctx.groupId, ctx.sender);
    const last = bank.last_work_at ? new Date(bank.last_work_at) : null;
    if (last && Date.now() - last.getTime() < COOLDOWN) {
      await ctx.reply(F.trabajoEspera({ remaining: formatRemaining(new Date(last.getTime() + COOLDOWN)) }), [ctx.sender]);
      return;
    }
    const [job, base] = JOBS[Math.floor(Math.random() * JOBS.length)];
    const reward = base + Math.floor(Math.random() * 25);
    await stampBank(ctx.groupId, ctx.sender, 'last_work_at');
    const result = await addBankCoins(ctx.groupId, ctx.sender, reward);
    await ctx.reply(F.trabajoCobrado({ user: mention(ctx.sender), job, reward, total: result.coins }), [ctx.sender]);
  },
};

register(work);
