import { registerPack, type BotPack } from '../../src/core/bot-packs.js';
import { registerAntilinkGuard, registerMuteGuard } from '../shared/antilink.js';
import { RAIDEN } from './brand.js';

/**
 * Ficha del pack Raiden WaBot.
 *
 * Se registra en su propio archivo porque las importaciones de los comandos se
 * evalúan antes que el cuerpo de `index.ts`: así el pack existe cuando cada
 * comando llama a `registerPackCommand`.
 */
export const RAIDEN_PACK: BotPack = {
  slug: RAIDEN.slug,
  aliases: ['raiden', 'raiden-wabot', 'raidenwabot', 'raiden-wabot-bot'],
  name: RAIDEN.name,
  emoji: RAIDEN.emoji,
  tagline: RAIDEN.tagline,
  description:
    'Bot anime en Node.js + Baileys inspirado en Raiden (Genshin Impact): descargas de Instagram, YouTube, Spotify y TikTok, stickers con estilo BRAT, IA conversacional, más de 40 reacciones anime, logos y moderación con antilink.',
  category: 'Juegos',
  accent: '#6366f1',
  link: 'https://github.com/Ryuzei-Ts/Raiden-WaBot',
  prefix: '.',
  folder: 'bots/raiden-wabot',
  features: [
    'Descargas: Instagram, YouTube, Spotify y TikTok',
    'Stickers: conversión a pegatina y estilo BRAT',
    'Más de 40 reacciones anime con menciones',
    'IA conversacional opcional (AI_API_KEY)',
    'Logos en cinco estilos y herramientas de grupo',
    'Moderación: antilink, mute y tagall',
    'Perfil social: matrimonio, cumpleaños y foto',
  ],
  highlights: ['download', 'play', 'sticker', 'brat', 'ai', 'logo', 'reaccion', 'marry', 'work', 'antilink', 'tagall'],
};

registerPack(RAIDEN_PACK);

// Guardias del pack: actúan con cada mensaje del grupo, no solo con comandos.
registerAntilinkGuard(RAIDEN_PACK.slug, { name: 'raiden-antilink', brand: RAIDEN.brand });
registerMuteGuard(RAIDEN_PACK.slug, { name: 'raiden-mute', brand: RAIDEN.brand });
