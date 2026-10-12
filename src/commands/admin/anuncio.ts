import { register, type Command } from '../../core/router.js';
import { audit } from '../../database/repos.js';
import { mention } from '../../messages/design.js';
import { anuncio } from '../../messages/design-extra.js';
import * as F from '../../messages/design-extra.js';

const anuncioCommand: Command = {
  name: 'anuncio',
  category: 'Administración',
  usage: '.anuncio <texto>',
  description: 'Envía un anuncio al grupo mencionando a todos.',
  groupOnly: true,
  adminOnly: true,
  async run(ctx) {
    const text = ctx.argText.trim();
    if (text.length < 3) return void (await ctx.reply(F.faltaObjetivo('.anuncio <texto del anuncio>')));
    const everyone = (ctx.meta?.participants ?? []).map((participant) => participant.id);
    await audit(ctx.groupId, ctx.sender, 'anuncio', null, { length: text.length });
    await ctx.reply(anuncio({ author: mention(ctx.sender), text: text.slice(0, 1500) }), [ctx.sender, ...everyone]);
  },
};

register(anuncioCommand);
