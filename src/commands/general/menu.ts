import { allCommands, register, type Command, type Ctx } from '../../core/router.js';
import { getSetting } from '../../database/repos.js';
import { config } from '../../config/index.js';
import { TEAM } from '../../messages/design.js';
import { logger } from '../../utils/logger.js';

export interface Banner {
  text: string;
  image: { mime: string; data: string } | null;
}

export const DEFAULT_BANNER_TEXT = [
  'ㅤㅤㅤㅤ࿚ׄ࿙ֹ࿚᮫᜔۬፟֟࿙ֹ࿚ׄ࿙',
  'ㅤㅤㅤ𓆩ㅤ禊ㅤ𓆪',
  'ㅤㅤ𝑽 𝑬́ 𝑹 𝑺 𝑶 𝑽 𝑨',
  'ㅤㅤㅤ( ᵕ ᴗ ᵕ )♡',
].join('\n');

const CATEGORY_ORDER: Command['category'][] = ['Registro', 'Roles', 'Equipo', 'Social', 'Administración', 'General'];

/** Construye el menú a partir del registro real de comandos: nunca muestra lo que no existe. */
export function buildMenu(): string {
  const cmds = allCommands();
  const sections = CATEGORY_ORDER.map((cat) => {
    const list = cmds.filter((c) => c.category === cat);
    if (!list.length) return '';
    return [
      `ㅤ◢ *${cat.toUpperCase()}* ◣`,
      ...list.map((c) => `ㅤ୨ৎㅤ${c.usage} — ${c.description}`),
      '',
    ].join('\n');
  }).filter(Boolean);

  return [
    '𓆩 ☕ 𓆪 *MENÚ DE COMANDOS*',
    'ㅤㅤ( ᵕ ᴗ ᵕ )♡',
    '',
    ...sections,
    `ㅤ𖦹 Prefijo ⁙ ${config.bot.prefix}   𖦹 Versión ⁙ ${config.bot.version}`,
    `ㅤ${TEAM}`,
  ].join('\n');
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
  async run(ctx: Ctx) {
    const banner = await loadBanner();
    const body = `${banner.text.trim() || DEFAULT_BANNER_TEXT}\n\n${buildMenu()}`;
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
