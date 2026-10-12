import { normalizeMessageContent, type WAMessage } from '@whiskeysockets/baileys';
import { normalizeJid } from '../utils/text.js';

/** JIDs mencionados en un mensaje (texto o media con caption). */
export function contextMentions(msg: WAMessage): string[] {
  const m = normalizeMessageContent(msg.message);
  const info =
    m?.extendedTextMessage?.contextInfo ?? m?.imageMessage?.contextInfo ?? m?.videoMessage?.contextInfo;
  return (info?.mentionedJid ?? []).map(normalizeJid);
}
