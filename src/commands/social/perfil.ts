import { register, type Command } from '../../core/router.js';
import { getCharacterById, getMember, getUser } from '../../database/repos.js';
import { countWarnings } from '../../database/warnings.js';
import { formatDate } from '../../utils/time.js';
import { userPart } from '../../utils/text.js';
import { mention } from '../../messages/design.js';
import * as F from '../../messages/design-extra.js';

const perfil: Command = {
  name: 'perfil',
  category: 'Social',
  usage: '.perfil <@usuario>',
  description: 'Muestra el perfil de un integrante.',
  groupOnly: true,
  async run(ctx) {
    const target = ctx.mentions[0] ?? ctx.quotedId ?? ctx.sender;
    const user = await getUser(ctx.groupId, target);
    const member = await getMember(ctx.groupId, target);
    if (!user) {
      const push = member?.push_name || `@${userPart(target)}`;
      return void (await ctx.reply(
        F.perfilUsuario({
          user: push,
          name: push,
          age: 0,
          character: 'Sin registrar',
          registered: new Date(member?.last_activity_at ?? Date.now()),
          afk: member?.afk_since ? `AFK (${member.afk_reason ?? 'sin motivo'})` : 'Activo',
          partner: 'Sin pareja',
          warnings: 0,
        }),
        [target],
      ));
    }
    const character = user.character_id ? await getCharacterById(user.character_id) : null;
    const warnings = await countWarnings(ctx.groupId, target);
    const partner = user.partner_id ? `@${userPart(user.partner_id)}` : 'Sin pareja';
    await ctx.reply(
      F.perfilUsuario({
        user: mention(target),
        name: user.name,
        age: user.age,
        character: character?.name ?? 'Sin personaje',
        registered: new Date(user.registered_at),
        afk: member?.afk_since ? `AFK desde ${formatDate(member.afk_since)} (${member.afk_reason ?? 'sin motivo'})` : 'Activo',
        partner,
        warnings,
      }),
      [target, ...(user.partner_id ? [user.partner_id] : [])],
    );
  },
};

register(perfil);
