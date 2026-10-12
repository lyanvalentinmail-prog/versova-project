import { commandsForPack, registerPackCommand, type Command, type Ctx } from '../../../src/core/bot-packs.js';
import { RAIDEN, raidenCard } from '../brand.js';

/** Menú propio de Raiden WaBot: se arma solo con los comandos del pack. */
const menu: Command = {
  name: 'menu',
  category: 'General',
  usage: '.menu [comando]',
  description: 'Muestra el menú de Raiden WaBot o la ayuda de un comando concreto.',
  async run(ctx: Ctx) {
    const requested = ctx.args[0]?.toLowerCase();
    const commands = allRaidenCommands();

    if (requested) {
      const command = commands.find((entry) => entry.name === requested);
      if (!command) {
        await ctx.reply(raidenCard({
          title: 'Comando no encontrado',
          emoji: '🔍',
          lines: [`No existe «${requested}» en ${RAIDEN.name}.`, 'Escribe `.menu` para ver la lista completa.'],
        }));
        return;
      }
      await ctx.reply(raidenCard({
        title: command.name,
        emoji: '📘',
        lines: [
          `Uso ⁙ ${command.usage}`,
          `Categoría ⁙ ${command.category}`,
          command.description,
          command.adminOnly ? 'Solo administradores.' : 'Abierto para todo el grupo.',
        ],
      }));
      return;
    }

    const byCategory = new Map<string, string[]>();
    for (const command of commands) {
      const list = byCategory.get(command.category) ?? [];
      list.push(`ㅤㅤ⚡ㅤ.${command.name}${command.usage.replace(/^\.[a-z0-9_-]+/i, '')}`);
      byCategory.set(command.category, list);
    }

    const sections: string[] = [];
    for (const [category, list] of byCategory) {
      sections.push(`ㅤㅤ◢ ${category} (${list.length}) ◣`, ...list, '');
    }

    await ctx.reply(raidenCard({
      title: 'Menú de comandos',
      emoji: '📜',
      lines: [
        `Nombre ⁙ ${RAIDEN.name}`,
        `Prefijo ⁙ .`,
        `Comandos ⁙ ${commands.length}`,
        `Versión ⁙ ${RAIDEN.version}`,
        '',
        ...sections,
        'El bot de rol VÉRSOVA sigue disponible: `.reg`, `.ficha`, `.perfil`, `.warn`…',
      ],
      footer: RAIDEN.brand,
    }));
  },
};

/** Comandos efectivos del pack (se leen en cada llamada, ya con todo registrado). */
const allRaidenCommands = (): Command[] => commandsForPack(RAIDEN.slug);

registerPackCommand(RAIDEN.slug, menu);
