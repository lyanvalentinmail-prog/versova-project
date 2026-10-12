import { registerPackCommand, type Command } from '../../../src/core/bot-packs.js';
import { LOGO_STYLES, logoSvg, svgToPng, type LogoStyle } from '../../shared/media.js';
import { cleanText } from '../../shared/text.js';
import { RAIDEN, raidenCard, raidenNote } from '../brand.js';

const STYLE_NAMES: Record<LogoStyle, string> = {
  neon: 'Neón',
  glitch: 'Glitch',
  gaming: 'Gaming',
  gold: 'Oro',
  fire: 'Fuego',
};

/** `.logo <texto> [estilo]` — genera el logo y lo manda como imagen (o como SVG). */
const logo: Command = {
  name: 'logo',
  category: 'Imágenes',
  usage: `.logo <texto> [${LOGO_STYLES.join('|')}]`,
  description: 'Genera un logo con el texto indicado en cinco estilos.',
  async run(ctx) {
    const styleArg = ctx.args.at(-1)?.toLowerCase() ?? '';
    const style = (LOGO_STYLES as string[]).includes(styleArg) ? (styleArg as LogoStyle) : 'neon';
    const rawText = (styleArg && style === styleArg ? ctx.args.slice(0, -1) : ctx.args).join(' ');
    const text = cleanText(rawText, 18);

    if (!text) {
      await ctx.reply(raidenCard({
        title: 'Generador de logos',
        emoji: '🎨',
        lines: [
          'Uso ⁙ `.logo Raiden neon`',
          `Estilos ⁙ ${LOGO_STYLES.map((entry) => `${entry} (${STYLE_NAMES[entry]})`).join(', ')}`,
        ],
      }));
      return;
    }

    const svg = logoSvg(text, style);
    const png = await svgToPng(svg);

    if (png) {
      await ctx.sock.sendMessage(
        ctx.chat,
        { image: png, caption: raidenNote(`🎨 ${text} · estilo ${STYLE_NAMES[style]}`) },
        { quoted: ctx.msg },
      );
      return;
    }

    await ctx.sock.sendMessage(
      ctx.chat,
      {
        document: Buffer.from(svg),
        mimetype: 'image/svg+xml',
        fileName: `${text.toLowerCase().replace(/\s+/g, '-')}-${style}.svg`,
        caption: raidenNote(`🎨 ${text} · ${STYLE_NAMES[style]} (SVG; instala \`sharp\` para recibirlo en PNG)`),
      },
      { quoted: ctx.msg },
    );
  },
};

registerPackCommand(RAIDEN.slug, logo);
