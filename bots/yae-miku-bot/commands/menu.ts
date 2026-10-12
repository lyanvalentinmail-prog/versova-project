import { commandsForPack, registerPackCommand, type Command } from '../../../src/core/bot-packs.js';
import { getCommandSettings } from '../../../src/core/command-settings.js';
import { readGroupSettings } from '../../shared/store.js';
import { humanDuration } from '../../shared/text.js';
import { YAE, yaeCard } from '../brand.js';

/** Menú de Yae Miku: comandos propios + los heredados del núcleo de VÉRSOVA. */
const menu: Command = {
  name: 'menu',
  category: 'General',
  usage: '.menu [comando]',
  description: 'Muestra el menú de Yae Miku Bot y la ayuda de un comando.',
  async run(ctx) {
    const all = commandsForPack(YAE.slug);
    const settings = getCommandSettings(YAE.slug);
    const requested = ctx.args[0]?.toLowerCase();

    if (requested) {
      const command = all.find((entry) => entry.name === requested);
      if (!command) {
        await ctx.reply(yaeCard({
          title: 'Comando no encontrado',
          emoji: '🔍',
          lines: [`No existe «${requested}».`, 'Escribe `.menu` para ver todo el catálogo.'],
        }));
        return;
      }
      await ctx.reply(yaeCard({
        title: command.name,
        emoji: '📘',
        lines: [`Uso ⁙ ${command.usage}`, `Categoría ⁙ ${command.category}`, command.description],
      }));
      return;
    }

    const own = all.filter((command) => command.pack === YAE.slug);
    const inherited = all.filter((command) => command.pack !== YAE.slug && !settings.hidden.includes(command.name));
    const extra: Record<string, unknown> = await readGroupSettings(ctx.groupId || ctx.chat).catch(() => ({}));
    const antilinkConfig = extra.antilink as { enabled?: boolean } | undefined;

    await ctx.reply(
      yaeCard({
        title: 'Menú de comandos',
        emoji: '📜',
        lines: [
          `Nombre ⁙ ${YAE.name}`,
          `Prefijo ⁙ .`,
          `Propios ⁙ ${own.length}`,
          `Heredados de VÉRSOVA ⁙ ${inherited.length}`,
          `Versión ⁙ ${YAE.version}`,
          `Uptime del proceso ⁙ ${humanDuration(process.uptime() * 1000)}`,
          '',
          '◢ Propios ◣',
          ...own.map((command) => `ㅤㅤ🎧ㅤ.${command.name}`),
          '',
          '◢ Moderación del grupo ◣',
          `ㅤㅤantilink ⁙ ${antilinkConfig?.enabled ? 'activado' : 'desactivado'}`,
          `ㅤㅤmute ⁙ ${extra.mute ? 'activado' : 'desactivado'}`,
          '',
          '◢ Roles y registro (heredados) ◣',
          ...inherited.filter((command) => ['Registro', 'Roles', 'Equipo'].includes(command.category)).map((command) => `ㅤㅤ🎧ㅤ.${command.name}`),
          '',
          'Los alias y comandos ocultos se ajustan desde el panel.',
        ],
      }),
      [],
    );
  },
};

registerPackCommand(YAE.slug, menu);
