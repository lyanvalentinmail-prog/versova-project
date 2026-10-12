import { registerPackCommand, type Command } from '../../../src/core/bot-packs.js';
import { ANTILINK_WARN_LIMIT, getAntilink, setAntilink, type AntilinkAction } from '../../shared/antilink.js';
import { YAE, yaeCard, yaeNote } from '../brand.js';

/**
 * `.antilink` de Yae Miku: borra los enlaces del grupo y decide qué pasa con quien
 * los envía. La misma configuración la aplica la guardia `yae-antilink` con cada
 * mensaje, así que aquí solo se gestiona el estado.
 */
const antilink: Command = {
  name: 'antilink',
  category: 'Moderación',
  usage: '.antilink <on|off|warn|delete|kick|status>',
  description: 'Activa, apaga o configura el borrado automático de enlaces.',
  groupOnly: true,
  adminOnly: true,
  async run(ctx) {
    const option = (ctx.args[0] ?? 'status').toLowerCase();
    const current = await getAntilink(ctx.groupId);

    if (['status', 'estado'].includes(option)) {
      await ctx.reply(
        yaeCard({
          title: 'Antilink',
          emoji: '🔗',
          lines: [
            `Estado ⁙ ${current.enabled ? 'activado' : 'desactivado'}`,
            `Acción ⁙ ${current.action}`,
            `Avisos antes de expulsar ⁙ ${ANTILINK_WARN_LIMIT}`,
            'Uso ⁙ `.antilink on` · `.antilink kick` · `.antilink off`',
          ],
        }),
      );
      return;
    }

    if (['off', 'no', 'desactivar'].includes(option)) {
      await setAntilink(ctx.groupId, { ...current, enabled: false });
      await ctx.reply(yaeNote('🔓 Antilink desactivado: los enlaces vuelven a estar permitidos.'));
      return;
    }

    if (['on', 'si', 'sí', 'activar', 'warn', 'delete', 'kick'].includes(option)) {
      const action: AntilinkAction = ['warn', 'delete', 'kick'].includes(option)
        ? (option as AntilinkAction)
        : current.action;
      await setAntilink(ctx.groupId, { enabled: true, action });
      await ctx.reply(
        yaeCard({
          title: 'Antilink activado',
          emoji: '🔒',
          lines: [
            `Acción ⁙ ${action}`,
            action === 'kick'
              ? 'Quien mande un enlace sale del grupo al instante.'
              : action === 'warn'
                ? `Tres avisos y expulsión.`
                : 'Solo se borra el enlace.',
            'Necesito ser administrador para borrar mensajes y expulsar.',
          ],
        }),
      );
      return;
    }

    await ctx.reply(yaeNote('🎧 Opciones: `.antilink on|off|warn|delete|kick|status`'));
  },
};

registerPackCommand(YAE.slug, antilink);
