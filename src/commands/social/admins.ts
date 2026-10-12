import { register, type Command } from '../../core/router.js';
import { listMembers, listUsers } from '../../database/repos.js';
import { adminIds } from '../../core/permissions.js';
import { userPart } from '../../utils/text.js';
import * as F from '../../messages/design-extra.js';

const admins: Command = {
  name: 'admins',
  category: 'Social',
  usage: '.admins',
  description: 'Muestra a los administradores del grupo.',
  groupOnly: true,
  async run(ctx) {
    const ids = ctx.meta ? adminIds(ctx.meta) : [];
    const [users, members] = await Promise.all([listUsers(ctx.groupId), listMembers(ctx.groupId)]);
    const names = new Map<string, string>([
      ...users.map((user) => [userPart(user.wa_id), user.name] as [string, string]),
      ...members.map((member) => [userPart(member.wa_id), member.push_name] as [string, string]),
    ]);
    const list = ids.map((id) => {
      const name = names.get(userPart(id));
      return name ? `${name} ⁙ @${userPart(id)}` : `@${userPart(id)}`;
    });
    await ctx.reply(F.adminsList({ admins: list }), ids);
  },
};

register(admins);
