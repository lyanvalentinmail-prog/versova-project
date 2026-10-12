import { register, type Command } from '../../core/router.js';
import { addBankCoins, addInventoryItem, getBank } from '../../database/repos.js';
import { COIN_ITEMS } from '../../web/platform-data.js';
import { mention } from '../../messages/design.js';
import * as F from '../../messages/design-extra.js';

const comprar: Command = {
  name: 'comprar',
  category: 'Economía',
  usage: '.comprar <id>',
  description: 'Compra un objeto de la tienda interna con V-Coins.',
  groupOnly: true,
  async run(ctx) {
    const id = ctx.args[0]?.toLowerCase() ?? '';
    const item = COIN_ITEMS.find((entry) => entry.id === id);
    if (!item) {
      return void (await ctx.reply(F.faltaObjetivo(`.comprar <id> · usa .tienda para ver los ids`)));
    }
    const bank = await getBank(ctx.groupId, ctx.sender);
    if (bank.coins < item.priceCoins) {
      return void (await ctx.reply(F.monedasInsuficientes({ needed: item.priceCoins, coins: bank.coins }), [ctx.sender]));
    }
    const charged = await addBankCoins(ctx.groupId, ctx.sender, -item.priceCoins);
    if (!charged.ok) {
      return void (await ctx.reply(F.monedasInsuficientes({ needed: item.priceCoins, coins: charged.coins }), [ctx.sender]));
    }
    await addInventoryItem(ctx.groupId, ctx.sender, { id: item.id, name: item.name });
    await ctx.reply(
      F.compraRealizada({ user: mention(ctx.sender), name: item.name, price: item.priceCoins, total: charged.coins }),
      [ctx.sender],
    );
  },
};

register(comprar);
