import { registerPackCommand, type Command } from '../../../src/core/bot-packs.js';
import { getActiveBotSlug } from '../../../src/core/active-bot.js';
import { logger } from '../../../src/utils/logger.js';
import { userPart } from '../../../src/utils/text.js';
import {
  deleteSubBotGroup,
  findSubBotsByGroupJid,
  getSubBotAny,
  listSubBotsByPhone,
  upsertSubBotGroup,
} from '../../../src/database/store.js';
import { joinArgs } from '../../shared/text.js';
import { YAE, yaeCard, yaeNote } from '../brand.js';

/**
 * `.subbots` — sub-bots persistentes del grupo.
 *
 * Cada grupo vinculado se guarda en `subbot_groups`, así que al reconectar la
 * instancia los grupos vuelven tal cual. Aquí se listan, se vinculan y se
 * desvinculan; para crear una instancia nueva se usa el panel (`/registrar`).
 */

interface SlimBot {
  id: number;
  name: string;
  status: string;
  catalog_slug: string;
  bot_type: string;
}

function findByName(pool: SlimBot[], query: string): SlimBot | null {
  const lower = query.trim().toLowerCase();
  if (!lower) return null;
  return (
    pool.find((bot) => String(bot.id) === lower) ??
    pool.find((bot) => bot.name.toLowerCase() === lower) ??
    pool.find((bot) => bot.name.toLowerCase().includes(lower)) ??
    null
  );
}

const subbots: Command = {
  name: 'subbots',
  category: 'Moderación',
  usage: '.subbots [link <id|nombre> | unlink <id|nombre>]',
  description: 'Lista, vincula o desvincula los sub-bots persistentes del grupo.',
  groupOnly: true,
  async run(ctx) {
    const action = (ctx.args[0] ?? '').toLowerCase();
    const query = joinArgs(ctx.args.slice(1));
    const linked = (await findSubBotsByGroupJid(ctx.groupId).catch((err) => {
      logger.warn('subbots', `Sin datos de grupos: ${(err as Error).message}`);
      return [];
    })) as SlimBot[];

    if (!action) {
      await ctx.reply(
        yaeCard({
          title: 'Sub-bots del grupo',
          emoji: '🧩',
          lines: [
            `Bot activo ⁙ ${getActiveBotSlug()}`,
            `Vinculados ⁙ ${linked.length}`,
            '',
            ...linked.map((bot) => `ㅤ#${bot.id} ${bot.name} ⁙ ${bot.status} · ${bot.catalog_slug || bot.bot_type}`),
            '',
            'Los sub-bots se guardan en la base y se restauran al reconectar.',
            'Crea uno nuevo en `/registrar` y vincúlalo con `.subbots link <id|nombre>`.',
          ],
        }),
      );
      return;
    }

    if (action === 'link') {
      if (!query) {
        await ctx.reply(yaeNote('🎧 Dime qué sub-bot: `.subbots link 3` o `.subbots link Mi Bot`.'));
        return;
      }

      const mine = (await listSubBotsByPhone(userPart(ctx.sender)).catch(() => [])) as SlimBot[];
      const byId = ctx.isOwner && /^\d+$/.test(query.trim()) ? await getSubBotAny(Number(query)) : null;
      const found = findByName(mine, query) ?? (byId as SlimBot | null);

      if (!found) {
        await ctx.reply(
          yaeNote(
            '🎧 No encontré ese sub-bot. Revisa el id en el panel (`/bots`) y que el teléfono o el número de dueño del bot coincida con el tuyo.',
          ),
        );
        return;
      }

      await upsertSubBotGroup(found.id, {
        jid: ctx.groupId,
        name: ctx.meta?.subject ?? 'Grupo de WhatsApp',
        members: ctx.meta?.participants?.length ?? 0,
        active: true,
      });
      await ctx.reply(
        yaeCard({
          title: 'Sub-bot vinculado',
          emoji: '✅',
          lines: [
            `Bot ⁙ #${found.id} ${found.name}`,
            `Grupo ⁙ ${ctx.meta?.subject ?? ctx.groupId}`,
            'Se restaurará solo al reconectar.',
          ],
        }),
      );
      return;
    }

    if (action === 'unlink') {
      const found = findByName(linked, query || String(linked[0]?.id ?? ''));
      if (!found) {
        await ctx.reply(yaeNote('🎧 No encontré ese sub-bot vinculado a este grupo.'));
        return;
      }
      await deleteSubBotGroup(found.id, ctx.groupId);
      await ctx.reply(yaeNote(`🗑️ Sub-bot #${found.id} desvinculado de este grupo.`));
      return;
    }

    await ctx.reply(yaeNote('🎧 Uso: `.subbots` · `.subbots link <id|nombre>` · `.subbots unlink <id|nombre>`'));
  },
};

registerPackCommand(YAE.slug, subbots);
