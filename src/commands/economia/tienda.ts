import { register, type Command } from '../../core/router.js';
import { COIN_ITEMS } from '../../web/platform-data.js';
import * as F from '../../messages/design-extra.js';

export const SHOP_IDS = COIN_ITEMS.map((item) => item.id);

const tienda: Command = {
  name: 'tienda',
  category: 'Economía',
  usage: '.tienda',
  description: 'Muestra la tienda interna del team (V-Coins).',
  groupOnly: true,
  async run(ctx) {
    await ctx.reply(
      F.tiendaInterna({
        items: COIN_ITEMS.map((item) => ({ id: item.id, name: item.name, price: item.priceCoins })),
      }),
    );
  },
};

register(tienda);
