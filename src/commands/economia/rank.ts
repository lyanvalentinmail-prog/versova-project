import { register, type Command } from '../../core/router.js';
import { bankRank, getUser } from '../../database/repos.js';
import { userPart } from '../../utils/text.js';
import * as F from '../../messages/design-extra.js';

const rank: Command = {
  name: 'rank',
  category: 'Economía',
  usage: '.rank',
  description: 'Ranking de los integrantes con más V-Coins.',
  groupOnly: true,
  async run(ctx) {
    const rows = await bankRank(ctx.groupId, 10);
    const list = await Promise.all(
      rows.map(async (row, index) => {
        const user = await getUser(ctx.groupId, row.wa_id);
        return { position: index + 1, name: user?.name ?? `@${userPart(row.wa_id)}`, coins: row.coins };
      }),
    );
    await ctx.reply(F.ranking({ rows: list }), rows.map((row) => row.wa_id));
  },
};

register(rank);
