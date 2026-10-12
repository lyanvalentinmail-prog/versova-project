import { register, type Command } from '../../core/router.js';
import { createRequest, ensureCharacter, getCharacterById, getUser, hasPendingRequest, setRequestMessage } from '../../database/repos.js';
import { normalizeKey, parseCharacterName } from '../../utils/text.js';
import * as F from '../../messages/design.js';
import { mention } from '../../messages/design.js';
import { adminIds } from '../../core/permissions.js';
import { characterAvailability } from './shared.js';

const rol: Command = {
  name: 'rol',
  category: 'Roles',
  usage: '.rol <personaje>',
  description: 'Solicita un personaje disponible.',
  groupOnly: true,
  async run(ctx) {
    const user = await getUser(ctx.groupId, ctx.sender);
    if (!user) return void (await ctx.reply(F.registroRechazado('Regístrate primero con .reg para pedir un personaje.')));
    if (user.character_id) {
      const current = await getCharacterById(user.character_id);
      return void (await ctx.reply(`Ya tienes el personaje *${current?.name ?? '?'}*. Usa .cambiarol para pedir otro.`));
    }
    const parsed = parseCharacterName(ctx.argText);
    if (!parsed.ok) return void (await ctx.reply(parsed.error));
    if (await hasPendingRequest(ctx.groupId, ctx.sender, 'rol')) {
      return void (await ctx.reply('Ya tienes una solicitud de personaje pendiente. Espera la respuesta de los admins.'));
    }

    const char = await ensureCharacter(ctx.groupId, parsed.value, normalizeKey(parsed.value));
    const check = await characterAvailability(char, ctx.sender);
    if (check) return void (await ctx.reply(check));

    const requestId = await createRequest(ctx.groupId, ctx.sender, 'rol', char.id);
    const admins = adminIds(ctx.meta!);
    const sent = await ctx.reply(
      F.solicitudPendiente({ kind: 'el personaje', character: char.name, requester: mention(ctx.sender) }),
      [...admins, ctx.sender],
    );
    if (sent?.key.id) await setRequestMessage(requestId, sent.key.id);
  },
};

register(rol);
