import { registerPackCommand, type Command } from '../../../src/core/bot-packs.js';
import { getActiveBotSlug } from '../../../src/core/active-bot.js';
import {
  ANTILINK_WARN_LIMIT,
  getAntilink,
  isMuted,
  setAntilink,
  setMuted,
  type AntilinkAction,
} from '../../shared/antilink.js';
import { readGroupSettings, writeGroupSetting } from '../../shared/store.js';
import { cleanText } from '../../shared/text.js';
import { YAE, yaeCard, yaeNote } from '../brand.js';

/** Claves que `.config` deja cambiar a mano (el resto solo lo toca el panel). */
const EDITABLE: Record<string, { description: string }> = {
  welcome: { description: 'Mensaje de bienvenida que el grupo quiera mostrar.' },
  rules: { description: 'Recordatorio corto de normas del grupo.' },
  timezone: { description: 'Zona horaria usada en los mensajes.' },
};

const config: Command = {
  name: 'config',
  category: 'Moderación',
  usage: '.config [clave valor]',
  description: 'Muestra o cambia la configuración del grupo (antilink, mute, welcome…).',
  groupOnly: true,
  async run(ctx) {
    const [rawKey = '', ...rest] = ctx.args;
    const key = rawKey.toLowerCase();
    const value = cleanText(rest.join(' '), 200);
    const antilink = await getAntilink(ctx.groupId);
    const muted = await isMuted(ctx.groupId);

    // `on/off` se permite a cualquier integrante para consultar; el resto es de admins.
    const isAdmin = ctx.isAdmin || ctx.isOwner;

    if (!key) {
      const settings = await readGroupSettings(ctx.groupId);
      const extra = Object.entries(settings).filter(([name]) => !['antilink', 'mute'].includes(name));
      await ctx.reply(
        yaeCard({
          title: 'Configuración del grupo',
          emoji: '⚙️',
          lines: [
            `Bot activo ⁙ ${getActiveBotSlug()}`,
            `Antilink ⁙ ${antilink.enabled ? `activado (${antilink.action})` : 'desactivado'}`,
            `Silencio ⁙ ${muted ? 'activado' : 'desactivado'}`,
            `Avisos antes de expulsar ⁙ ${ANTILINK_WARN_LIMIT}`,
            '',
            ...extra.map(([name, entry]) => `${name} ⁙ ${typeof entry === 'string' ? entry : JSON.stringify(entry)}`),
            '',
            isAdmin
              ? 'Uso ⁙ `.config antilink on|off|delete|warn|kick` · `.config mute on|off` · `.config welcome ¡Hola!`'
              : 'Solo los administradores pueden cambiarla.',
          ].filter(Boolean),
        }),
      );
      return;
    }

    if (!isAdmin) {
      await ctx.reply(yaeNote('⛔ Solo los administradores pueden cambiar la configuración.'), [ctx.sender]);
      return;
    }

    if (key === 'antilink') {
      const option = value.toLowerCase();
      if (['off', 'no', 'desactivar'].includes(option)) {
        await setAntilink(ctx.groupId, { ...antilink, enabled: false });
        await ctx.reply(yaeNote('🔓 Antilink desactivado.'));
        return;
      }
      if (!option || ['on', 'si', 'sí', 'activar', 'warn', 'delete', 'kick'].includes(option)) {
        const action: AntilinkAction = ['warn', 'delete', 'kick'].includes(option)
          ? (option as AntilinkAction)
          : antilink.action;
        await setAntilink(ctx.groupId, { enabled: true, action });
        await ctx.reply(
          yaeCard({
            title: 'Antilink actualizado',
            emoji: '🔗',
            lines: [`Estado ⁙ activado`, `Acción ⁙ ${action}`],
          }),
        );
        return;
      }
      await ctx.reply(yaeNote('⚙️ Usa `.config antilink on|off|delete|warn|kick`.'));
      return;
    }

    if (key === 'mute') {
      const option = value.toLowerCase();
      const on = ['on', 'si', 'sí', 'activar'].includes(option);
      const off = ['off', 'no', 'desactivar'].includes(option);
      if (!on && !off) {
        await ctx.reply(yaeNote('⚙️ Usa `.config mute on` o `.config mute off`.'));
        return;
      }
      await setMuted(ctx.groupId, on);
      await ctx.reply(yaeNote(on ? '🔇 Grupo silenciado.' : '🔊 Grupo con voz libre otra vez.'));
      return;
    }

    if (!EDITABLE[key]) {
      await ctx.reply(
        yaeNote(`⚙️ Claves disponibles: ${Object.keys({ antilink: 1, mute: 1, ...EDITABLE }).join(', ')}`),
      );
      return;
    }
    if (!value) {
      await ctx.reply(yaeNote(`⚙️ Escribe un valor: \`.config ${key} …\`.`));
      return;
    }

    await writeGroupSetting(ctx.groupId, key, value);
    await ctx.reply(yaeNote(`✅ Guardado: ${key} ⁙ ${value}`));
  },
};

registerPackCommand(YAE.slug, config);
