import { register, type Command } from '../../core/router.js';
import { listMembers, listUsers } from '../../database/repos.js';
import { normalizeJid, userPart } from '../../utils/text.js';
import * as F from '../../messages/design-extra.js';

const miembros: Command = {
  name: 'miembros',
  category: 'Equipo',
  usage: '.miembros',
  description: 'Lista a los integrantes del grupo.',
  groupOnly: true,
  async run(ctx) {
    const [members, users] = await Promise.all([listMembers(ctx.groupId), listUsers(ctx.groupId)]);
    const registered = new Map(users.map((user) => [userPart(user.wa_id), user.name]));
    const people = (ctx.meta?.participants ?? []).map((participant) => {
      const id = normalizeJid(participant.id);
      const name = registered.get(userPart(id));
      const label = name ? `${name}${participant.admin ? ' 👑' : ''}` : `@${userPart(id)}${participant.admin ? ' 👑' : ''}`;
      return { id, label };
    });
    const fallback = members.map((member) => ({
      id: member.wa_id,
      label: registered.get(userPart(member.wa_id)) ?? (member.push_name || `@${userPart(member.wa_id)}`),
    }));
    const list = (people.length ? people : fallback).slice(0, 40);
    await ctx.reply(
      F.miembrosList({ names: list.map((person) => person.label), total: (people.length || fallback.length) }),
      list.map((person) => person.id),
    );
  },
};

register(miembros);
