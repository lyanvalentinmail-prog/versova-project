import { register, type Command } from '../../core/router.js';
import { listMembers, listUsers } from '../../database/repos.js';
import { config } from '../../config/index.js';
import { userPart } from '../../utils/text.js';
import * as F from '../../messages/design-extra.js';

const inactivos: Command = {
  name: 'inactivos',
  category: 'Equipo',
  usage: '.inactivos [días]',
  description: 'Muestra integrantes inactivos (por defecto 7 días).',
  groupOnly: true,
  async run(ctx) {
    const requested = Number(ctx.args[0]);
    const days = Number.isFinite(requested) && requested > 0 ? Math.min(365, Math.floor(requested)) : config.defaults.inactivityDays;
    const [members, users] = await Promise.all([listMembers(ctx.groupId), listUsers(ctx.groupId)]);
    const names = new Map(users.map((user) => [userPart(user.wa_id), user.name]));
    const limit = Date.now() - days * 24 * 60 * 60 * 1000;
    const rows = members
      .filter((member) => new Date(member.last_activity_at).getTime() < limit)
      .sort((a, b) => new Date(a.last_activity_at).getTime() - new Date(b.last_activity_at).getTime())
      .slice(0, 30)
      .map((member) => ({
        name: names.get(userPart(member.wa_id)) ?? (member.push_name || `@${userPart(member.wa_id)}`),
        since: new Date(member.last_activity_at),
      }));
    await ctx.reply(F.inactivosList({ days, rows }));
  },
};

register(inactivos);
