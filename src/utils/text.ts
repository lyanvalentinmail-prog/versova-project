import { jidNormalizedUser } from '@whiskeysockets/baileys';
import { config } from '../config/index.js';

export const digitsOnly = (s: string): string => s.replace(/\D/g, '');

/** Parte numérica de un JID o LID: "59899999999:12@s.whatsapp.net" -> "59899999999" */
export const userPart = (jid: string): string => jid.split('@')[0].split(':')[0];

export const normalizeJid = (jid: string): string => jidNormalizedUser(jid);

/** Clave comparable para nombres de personajes: sin tildes, minúsculas, espacios simples. */
export function normalizeKey(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

/** Muestra un número sin revelarlo completo: +59 ••• ••• 1234 */
export function maskPhone(jid: string): string {
  const d = userPart(jid);
  return `+${d.slice(0, 2)} ••• ••• ${d.slice(-4)}`;
}

export type ParseResult<T> = { ok: true; value: T } | { ok: false; error: string };

/** Valida "nombre.edad". El punto separa: el último punto divide nombre y edad. */
export function parseNameAge(raw: string): ParseResult<{ name: string; age: number }> {
  const text = raw.trim();
  const idx = text.lastIndexOf('.');
  if (idx < 0) return { ok: false, error: 'Usa el formato nombre.edad. Ejemplo: .reg Moon.17' };

  const name = text.slice(0, idx).replace(/\s+/g, ' ').trim();
  const ageText = text.slice(idx + 1).trim();

  if (!name) return { ok: false, error: 'El nombre no puede estar vacío.' };
  if (name.length > config.defaults.nameMaxLength) {
    return { ok: false, error: `El nombre no puede superar ${config.defaults.nameMaxLength} caracteres.` };
  }
  if (!/^[\p{L}\p{N} _\-'·.]+$/u.test(name)) {
    return { ok: false, error: 'El nombre solo puede contener letras, números, espacios y _ - \' ·' };
  }
  if (!/^\d{1,3}$/.test(ageText)) return { ok: false, error: 'La edad debe ser un número.' };

  const age = Number(ageText);
  const { minAge, maxAge } = config.defaults;
  if (age < minAge || age > maxAge) {
    return { ok: false, error: `La edad debe estar entre ${minAge} y ${maxAge}.` };
  }
  return { ok: true, value: { name, age } };
}

/** Convierte "algo" en un nombre de personaje válido. */
export function parseCharacterName(raw: string): ParseResult<string> {
  const name = raw.replace(/\s+/g, ' ').trim();
  if (!name) return { ok: false, error: 'Indica el nombre del personaje.' };
  if (name.length > 40) return { ok: false, error: 'El nombre del personaje es demasiado largo (máx. 40).' };
  if (!/^[\p{L}\p{N} _\-'·.]+$/u.test(name)) {
    return { ok: false, error: 'El nombre del personaje contiene caracteres no permitidos.' };
  }
  return { ok: true, value: name };
}
