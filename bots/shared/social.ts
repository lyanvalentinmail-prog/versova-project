/**
 * Parejas (matrimonio y divorcio) para los bots del catálogo.
 *
 * Se guarda en el almacén de los bots (`bot_data`), así que funciona igual con
 * PostgreSQL y en modo memoria, y cada bot del catálogo puede usar sus propios
 * textos sin tocar el registro de personajes de VÉRSOVA.
 */
import { readText, writeText, clearText } from './store.js';

export const PARTNER_KEY = 'partner';
export const PARTNER_SINCE_KEY = 'partner_since';

export interface PartnerInfo {
  jid: string;
  since: Date | null;
}

export async function getPartner(groupId: string, waId: string): Promise<PartnerInfo | null> {
  const jid = await readText(groupId, waId, PARTNER_KEY);
  if (!jid) return null;
  const raw = await readText(groupId, waId, PARTNER_SINCE_KEY);
  const since = raw && !Number.isNaN(Number(raw)) ? new Date(Number(raw)) : null;
  return { jid, since };
}

export async function setPartner(groupId: string, a: string, b: string): Promise<void> {
  await writeText(groupId, a, PARTNER_KEY, b);
  await writeText(groupId, b, PARTNER_KEY, a);
  const now = String(Date.now());
  await writeText(groupId, a, PARTNER_SINCE_KEY, now);
  await writeText(groupId, b, PARTNER_SINCE_KEY, now);
}

export async function clearPartner(groupId: string, a: string, b: string): Promise<void> {
  await clearText(groupId, a, PARTNER_KEY);
  await clearText(groupId, b, PARTNER_KEY);
  await clearText(groupId, a, PARTNER_SINCE_KEY);
  await clearText(groupId, b, PARTNER_SINCE_KEY);
}

/** Días que llevan juntos (0 si no hay fecha). */
export function daysTogether(info: PartnerInfo | null, now = Date.now()): number {
  if (!info?.since) return 0;
  return Math.max(0, Math.floor((now - info.since.getTime()) / 86_400_000));
}
