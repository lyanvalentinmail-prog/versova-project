/**
 * Almacén de datos de los bots del catálogo.
 *
 * Todos los packs guardan su información con la misma capa `src/database/store.js`
 * (PostgreSQL o modo memoria, según la configuración), así que las funciones de
 * este archivo sirven para cualquier bot: contadores, textos, JSON y ajustes del
 * grupo.
 */
import {
  addBotValue,
  deleteBotValue,
  getBotValue,
  getGroupSetting,
  getGroupSettings,
  listBotValues,
  setBotValue,
  setGroupSetting,
} from '../../src/database/store.js';

export async function readText(groupId: string, waId: string, key: string): Promise<string | null> {
  return getBotValue(groupId, waId, key);
}

export async function writeText(groupId: string, waId: string, key: string, value: string): Promise<void> {
  await setBotValue(groupId, waId, key, value);
}

export async function clearText(groupId: string, waId: string, key: string): Promise<void> {
  await deleteBotValue(groupId, waId, key);
}

export async function readNumber(groupId: string, waId: string, key: string): Promise<number> {
  return Number((await getBotValue(groupId, waId, key)) ?? 0) || 0;
}

export async function bumpNumber(groupId: string, waId: string, key: string, delta: number): Promise<number> {
  return addBotValue(groupId, waId, key, delta);
}

export async function readJson<T>(groupId: string, waId: string, key: string): Promise<T | null> {
  const raw = await getBotValue(groupId, waId, key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function writeJson(groupId: string, waId: string, key: string, value: unknown): Promise<void> {
  await setBotValue(groupId, waId, key, JSON.stringify(value));
}

/** Entradas guardadas en una clave concreta (para rankings). */
export async function listEntries(groupId: string, key: string): Promise<Array<{ waId: string; value: string }>> {
  const rows = await listBotValues(groupId, key);
  return rows.map((row) => ({ waId: row.wa_id, value: row.value }));
}

/* --------------------------- ajustes del grupo --------------------------- */

export async function readGroupSetting<T>(groupId: string, key: string): Promise<T | null> {
  return getGroupSetting<T>(groupId, key);
}

export async function writeGroupSetting(groupId: string, key: string, value: unknown): Promise<void> {
  await setGroupSetting(groupId, key, value);
}

export async function readGroupSettings(groupId: string): Promise<Record<string, unknown>> {
  return getGroupSettings(groupId);
}

/** Cooldown compartido: devuelve los segundos que faltan (0 si ya se puede usar). */
export async function cooldownLeft(groupId: string, waId: string, key: string, ms: number): Promise<number> {
  const last = Number((await getBotValue(groupId, waId, key)) ?? 0) || 0;
  const left = last + ms - Date.now();
  return left > 0 ? Math.ceil(left / 1000) : 0;
}

export async function markUsed(groupId: string, waId: string, key: string): Promise<void> {
  await setBotValue(groupId, waId, key, String(Date.now()));
}
