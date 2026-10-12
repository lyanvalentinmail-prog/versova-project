import { register, type Command } from '../../core/router.js';
import { createRequest, ensureCharacter, getCharacterById, getUser, hasPendingRequest, setRequestMessage } from '../../database/repos.js';
import { normalizeKey, parseCharacterName } from '../../utils/text.js';
import * as F from '../../messages/design.js';
import { mention } from '../../messages/design.js';
import { adminIds } from '../../core/permissions.js';
import { characterAvailability } from './shared.js';

const cambiarol: Command = {
  name: 'cambiarol',
  category: 'Roles',
  usage: '.cambiarol <personaje>',
  description: 'Solicita cambiar tu personaje (requiere aprobación).',
  groupOnly: true,
  async run(ctx) {
    const user = await getUser(ctx.groupId, ctx.sender);
    if (!user) return void (await ctx.reply(F.registroRechazado('Regístrate primero con .reg.')));
    if (!user.character_id) return void (await ctx.reply('Aún no tienes personaje. Usa .rol <personaje>.'));
    const parsed = parseCharacterName(ctx.argText);
    if (!parsed.ok) return void (await ctx.reply(parsed.error));
    const current = await getCharacterById(user.character_id);
    if (current && normalizeKey(current.name) === normalizeKey(parsed.value)) {
      return void (await ctx.reply('Ese ya es tu personaje.'));
    }
    if (await hasPendingRequest(ctx.groupId, ctx.sender, 'cambio')) {
      return void (await ctx.reply('Ya tienes un cambio de personaje pendiente.'));
    }
    const char = await ensureCharacter(ctx.groupId, parsed.value, normalizeKey(parsed.value));
    const check = await characterAvailability(char, ctx.sender);
    if (check) return void (await ctx.reply(check));

    const requestId = await createRequest(ctx.groupId, ctx.sender, 'cambio', char.id, String(user.character_id));
    const sent = await ctx.reply(
      F.solicitudPendiente({
        kind: `cambiar a *${current?.name ?? '?'}* por el personaje`,
        character: char.name,
        requester: mention(ctx.sender),
      }),
      [...adminIds(ctx.meta!), ctx.sender],
    );
    if (sent?.key.id) await setRequestMessage(requestId, sent.key.id);
  },
};

register(cambiarol);
