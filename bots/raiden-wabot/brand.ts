/**
 * Identidad de Raiden WaBot: ⚡ anime, descargas, stickers e IA.
 * Todos los mensajes del pack pasan por `raidenCard` para mantener el mismo estilo.
 */

export const RAIDEN = {
  slug: 'raiden-wabot',
  name: 'Raiden WaBot',
  short: 'ʀᴀɪᴅᴇɴ',
  emoji: '⚡',
  tagline: 'Bot anime completo: descargas, stickers, IA y más',
  brand: '⚡ ʀᴀɪᴅᴇɴ ᴡᴀʙᴏᴛ',
  line: '╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌',
  version: '1.4.0',
} as const;

export interface RaidenCard {
  title: string;
  emoji?: string;
  lines: string[];
  footer?: string;
}

/** Tarjeta de texto del bot: cabecera con rayo, cuerpo y firma. */
export function raidenCard(card: RaidenCard): string {
  const head = `${RAIDEN.emoji}ㅤ*${card.title.toUpperCase()}*${card.emoji ? `ㅤ${card.emoji}` : ''}`;
  return [
    'ㅤ⚡ㅤ׃ㅤ~ʀᴀɪᴅᴇɴ~ㅤ׃ㅤ⚡',
    RAIDEN.line,
    head,
    '',
    ...card.lines.map((line) => (line ? `ㅤ➢ㅤ${line}` : '')),
    '',
    `ㅤ⌞ㅤ${card.footer ?? RAIDEN.brand}`,
    RAIDEN.line,
  ].join('\n');
}

export const raidenNote = (text: string): string => `⚡ㅤ${text}`;
