import { register, type Command } from '../../core/router.js';
import { getGroup, listCharactersOccupied, listMembers, listUsers } from '../../database/repos.js';
import { config } from '../../config/index.js';
import * as F from '../../messages/design-extra.js';

const team: Command = {
  name: 'team',
  category: 'Equipo',
  usage: '.team',
  description: 'Muestra la información del team.',
  groupOnly: true,
  async run(ctx) {
    const [group, members, users, occupied] = await Promise.all([
      getGroup(ctx.groupId),
      listMembers(ctx.groupId),
      listUsers(ctx.groupId),
      listCharactersOccupied(ctx.groupId),
    ]);
    await ctx.reply(
      F.teamInfo({
        name: group?.name || ctx.meta?.subject || 'Team',
        members: ctx.meta?.participants.length ?? members.length,
        admins: ctx.meta?.participants.filter((p) => p.admin).length ?? group?.admins.length ?? 0,
        registered: users.length,
        characters: users.length,
        occupied: occupied.length,
        prefix: config.bot.prefix,
      }),
    );
  },
};

register(team);
