import { register, type Command } from '../../core/router.js';
import { getCharacterById, getMember, getUser } from '../../database/repos.js';
import { countWarnings } from '../../database/warnings.js';
import { formatDate } from '../../utils/time.js';
import { maskPhone } from '../../utils/text.js';
import * as F from '../../messages/design.js';
import { config } from '../../config/index.js';

const ficha: Command = {
  name: 'ficha',
  category: 'Registro',
  usage: '.ficha',
  description: 'Muestra tu información personal.',
  groupOnly: true,
  async run(ctx) {
    const user = await getUser(ctx.groupId, ctx.sender);
    if (!user) return void (await ctx.reply(F.registroRechazado('No estás registrado. Usa .reg <nombre.edad>.')));
    const member = await getMember(ctx.groupId, ctx.sender);
    const ch = user.character_id ? await getCharacterById(user.character_id) : null;
    const warnings = await countWarnings(ctx.groupId, ctx.sender);
    const estado = member?.afk_since
      ? `AFK desde ${formatDate(member.afk_since)} (${member.afk_reason})`
      : 'Activo';
    await ctx.reply(
      F.perfilCard({
        name: user.name,
        age: user.age,
        character: ch?.name ?? 'Sin personaje',
        registered: user.registered_at,
        phone: maskPhone(ctx.sender),
        afk: estado,
        partner: 'Sin pareja',
      }) + `\n\nAdvertencias ⁙ ${warnings}/${config.defaults.warnLimit}`,
    );
  },
};

register(ficha);
