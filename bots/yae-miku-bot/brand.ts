/**
 * Identidad de Yae Miku Bot: 🎧 rol y moderación con sub-bots persistentes.
 */

export const YAE = {
  slug: 'yae-miku-bot',
  name: 'Yae Miku Bot',
  short: 'ʏᴀᴇ ᴍɪᴋᴜ',
  emoji: '🎧',
  tagline: 'Bot de rol y moderación con sub-bots',
  brand: '🎧 ʏᴀᴇ ᴍɪᴋᴜ ʙᴏᴛ',
  line: '┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄',
  version: '2.1.0',
} as const;

export interface YaeCard {
  title: string;
  emoji?: string;
  lines: string[];
  footer?: string;
}

/** Tarjeta de texto del bot, con la estética de Yae Miku. */
export function yaeCard(card: YaeCard): string {
  const head = `${YAE.emoji}ㅤ*${card.title.toUpperCase()}*${card.emoji ? `ㅤ${card.emoji}` : ''}`;
  return [
    'ㅤ🎧ㅤ׃ㅤ~ʏᴀᴇ ᴍɪᴋᴜ~ㅤ׃ㅤ🎧',
    YAE.line,
    head,
    '',
    ...card.lines.map((line) => (line ? `ㅤ➢ㅤ${line}` : '')),
    '',
    `ㅤ⌞ㅤ${card.footer ?? YAE.brand}`,
    YAE.line,
  ].join('\n');
}

export const yaeNote = (text: string): string => `🎧ㅤ${text}`;
