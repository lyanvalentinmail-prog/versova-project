import { registerPackCommand, type Command } from '../../../src/core/bot-packs.js';
import { cleanText, joinArgs, pick } from '../../shared/text.js';
import { isWebp, quotedMedia, sharpAvailable, svgToPng, toStickerWebp } from '../../shared/media.js';
import { RAIDEN, raidenCard, raidenNote } from '../brand.js';

const BRAT_PHRASES = [
  'no sé qué decir',
  'es lo que hay',
  'modo caos',
  'listo bb',
  'ya fue',
  'xd',
];

/** SVG estilo BRAT: fondo blanco, texto negro, recortado a 512×512. */
function bratSvg(text: string): string {
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
  const size = Math.min(96, Math.max(34, Math.floor(420 / Math.max(6, escaped.length / 1.6))));
  return `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#ffffff"/>
  <text x="256" y="236" text-anchor="middle" fill="#111111"
        font-family="Arial, Helvetica, sans-serif" font-weight="bold" font-size="${size}">${escaped}</text>
  <text x="256" y="366" text-anchor="middle" fill="#111111" opacity="0.45"
        font-family="Arial, Helvetica, sans-serif" font-size="22">${RAIDEN.short} · brat</text>
</svg>`;
}

const sticker: Command = {
  name: 'sticker',
  category: 'Stickers',
  usage: '.sticker (responde a una imagen o video)',
  description: 'Convierte la imagen o el video que respondes en una pegatina.',
  async run(ctx) {
    const media = await quotedMedia(ctx.msg, ctx.quotedId);
    if (!media) {
      await ctx.reply(raidenCard({
        title: 'Falta el archivo',
        emoji: '🖼️',
        lines: [
          'Responde a una imagen, un video o una pegatina con `.sticker`.',
          'También puedes mandar la imagen con `.sticker` en la leyenda.',
        ],
      }));
      return;
    }

    const webp = await toStickerWebp(media.buffer, media.kind);
    if (!webp || !isWebp(webp)) {
      await ctx.reply(raidenCard({
        title: 'Convertidor no disponible',
        emoji: '🧩',
        lines: [
          media.kind === 'sticker'
            ? 'No pude leer esa pegatina.'
            : `Recibí un archivo ${media.mimetype}, pero no tengo con qué convertirlo.`,
          'Instala el conversor opcional en el servidor: `npm i sharp`.',
          'Sin él, Raiden solo puede reenviar pegatinas que ya estén en WebP.',
        ],
      }));
      return;
    }

    await ctx.sock.sendMessage(ctx.chat, { sticker: webp }, { quoted: ctx.msg });
  },
};

const brat: Command = {
  name: 'brat',
  category: 'Stickers',
  usage: '.brat <texto>',
  description: 'Crea una pegatina estilo BRAT (fondo blanco y letra negra).',
  async run(ctx) {
    const text = cleanText(joinArgs(ctx.args), 90) || pick(BRAT_PHRASES, Date.now() / 1000);
    const svg = bratSvg(text);
    const png = await svgToPng(svg);

    if (!png) {
      const canRasterize = await sharpAvailable();
      await ctx.reply(raidenCard({
        title: 'Brat en modo texto',
        emoji: '🖤',
        lines: [
          `Texto ⁙ ${text}`,
          canRasterize ? 'No pude generar la imagen.' : 'Para generar la pegatina instala `sharp`: npm i sharp',
        ],
      }));
      return;
    }

    const webp = await toStickerWebp(png, 'image');
    if (webp && isWebp(webp)) {
      await ctx.sock.sendMessage(ctx.chat, { sticker: webp }, { quoted: ctx.msg });
      return;
    }
    await ctx.sock.sendMessage(
      ctx.chat,
      { image: png, caption: raidenNote(`🖤 ${text}`) },
      { quoted: ctx.msg },
    );
  },
};

registerPackCommand(RAIDEN.slug, sticker, brat);
