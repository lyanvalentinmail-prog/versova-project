import { register, type Command } from '../../core/router.js';
import { getSetting } from '../../database/repos.js';
import { getCommandSettings } from '../../core/command-settings.js';
import { renderMenuText, DEFAULT_BANNER_TEXT } from '../catalog.js';
import { logger } from '../../utils/logger.js';

export interface Banner {
  text: string;
  image: { mime: string; data: string } | null;
}

export { DEFAULT_BANNER_TEXT };

/** Construye el menú exacto solicitado y aplica los ajustes guardados desde la consola. */
export function buildMenu(bannerText = ''): string {
  return renderMenuText(bannerText, getCommandSettings());
}

export async function loadBanner(): Promise<Banner> {
  const stored = await getSetting<Banner>('banner');
  return stored ?? { text: '', image: null };
}

const menu: Command = {
  name: 'menu',
  category: 'General',
  usage: '.menu',
  description: 'Muestra el menú de comandos.',
  async run(ctx) {
    const banner = await loadBanner();
    const body = buildMenu(banner.text);
    if (banner.image) {
      try {
        const buffer = Buffer.from(banner.image.data, 'base64');
        await ctx.sock.sendMessage(ctx.chat, { image: buffer, caption: body, mimetype: banner.image.mime }, { quoted: ctx.msg });
        return;
      } catch (err) {
        logger.warn('menu', `No se pudo enviar la imagen del banner: ${(err as Error).message}`);
      }
    }
    await ctx.reply(body);
  },
};

register(menu);
