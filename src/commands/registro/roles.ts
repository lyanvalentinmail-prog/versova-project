import { register, type Command } from '../../core/router.js';
import { listCharactersOccupied, listUsers } from '../../database/repos.js';

const roles: Command = {
  name: 'roles',
  category: 'Roles',
  usage: '.roles',
  description: 'Muestra los personajes ocupados.',
  groupOnly: true,
  async run(ctx) {
    const [occupied, users] = await Promise.all([listCharactersOccupied(ctx.groupId), listUsers(ctx.groupId)]);
    const byId = new Map(users.map((u) => [u.wa_id, u.name]));
    const lines = occupied.map((c) => `ㅤ୨ৎㅤ*${c.name}* ⁙ ${byId.get(c.owner_id!) ?? 'Desconocido'}`);
    await ctx.reply(
      [
        '🥢 *PERSONAJES OCUPADOS*',
        '',
        ...(lines.length ? lines : ['ㅤ(ᵕ—ᴗ—ᵕ) Ningún personaje ocupado todavía.']),
        '',
        `Total ocupados ⁙ ${occupied.length}`,
      ].join('\n'),
    );
  },
};

register(roles);
