/**
 * Carga de los bots del catálogo.
 *
 * Cada carpeta de `bots/` registra su pack y sus comandos al importarse. Este
 * módulo es el único punto que conoce a todos los bots: la plataforma (router,
 * web y arranque) lo usa para saber qué bots existen, cuál está activo y qué
 * comandos tiene cada uno.
 */
import { getActiveBotSlug, setActiveBot, ACTIVE_BOT_KEY, type ActiveBotState } from '../core/active-bot.js';
import {
  allPacks,
  commandsForPack,
  getPack,
  packCommands,
  resolvePackSlug,
  type BotPack,
} from '../core/bot-packs.js';
import { getSetting, setSetting } from '../database/store.js';
import { loadCommandSettings } from '../core/command-settings.js';

// Los tres bots del catálogo, en el orden en que aparecen en la tienda.
import '../../bots/versova/index.js';
import '../../bots/raiden-wabot/index.js';
import '../../bots/yae-miku-bot/index.js';

export { allPacks, commandsForPack, getPack, packCommands, resolvePackSlug };
export type { BotPack };

export interface BotPackSummary extends BotPack {
  /** Comandos propios del pack. */
  ownCommands: number;
  /** Comandos efectivos (núcleo + propios). */
  totalCommands: number;
  /** ¿Es el bot que está hablando ahora mismo? */
  active: boolean;
}

/** Resumen de cada bot para el panel y la API. */
export function packSummaries(): BotPackSummary[] {
  const active = getActiveBotSlug();
  return allPacks().map((pack) => ({
    ...pack,
    ownCommands: packCommands(pack.slug).length,
    totalCommands: commandsForPack(pack.slug).length,
    active: pack.slug === active,
  }));
}

/** Ajustes de comandos de todos los packs (cada bot tiene los suyos). */
export async function loadAllCommandSettings(): Promise<void> {
  for (const pack of allPacks()) {
    const commands = commandsForPack(pack.slug);
    await loadCommandSettings(commands.map((command) => command.name), commands.map((command) => command.name), pack.slug);
  }
}

/** Recupera el bot activo guardado por el panel (o deja el de `BOT_TYPE`). */
export async function loadActiveBotFromStore(): Promise<string> {
  const stored = await getSetting<Partial<ActiveBotState>>(ACTIVE_BOT_KEY).catch(() => null);
  if (stored?.slug) return setActiveBot(stored.slug, stored.subbotId ?? null);
  return getActiveBotSlug();
}

/** Cambia el bot activo y lo guarda para que sobreviva al reinicio. */
export async function activateBot(slug: string, subbotId: number | null = null): Promise<string> {
  const applied = setActiveBot(slug, subbotId);
  await setSetting(ACTIVE_BOT_KEY, { slug: applied, subbotId } satisfies ActiveBotState).catch(() => undefined);
  return applied;
}

/**
 * Menú en texto de cualquier bot del catálogo (lo usa la vista previa del panel).
 * VÉRSOVA tiene su propia plantilla decorada en `src/commands/catalog.ts`; para el
 * resto se genera la lista agrupada por categorías.
 */
export function renderBotMenuText(slug: string): string {
  const pack = getPack(resolvePackSlug(slug) ?? '');
  if (!pack) return '';
  const commands = commandsForPack(pack.slug);
  const byCategory = new Map<string, string[]>();
  for (const command of commands) {
    const list = byCategory.get(command.category) ?? [];
    list.push(`ㅤ${pack.emoji}ㅤ\`${command.usage}\``);
    byCategory.set(command.category, list);
  }
  const body = [...byCategory.entries()]
    .map(([category, list]) => [`ㅤㅤ◢ ${category.toUpperCase()} ◣ (${list.length})`, ...list, ''].join('\n'))
    .join('\n');
  return [
    `ㅤㅤㅤ${pack.emoji}ㅤ*${pack.name.toUpperCase()}*`,
    `ㅤㅤㅤ${pack.tagline}`,
    '',
    body,
    `ㅤ⌞ㅤ${pack.name} · ${pack.folder} · ${pack.link}`,
  ].join('\n');
}

/** Bot del catálogo asociado a un slug o alias (para el asistente y el panel). */
export function packForSlug(slug: string | null | undefined): BotPack | null {
  return getPack(resolvePackSlug(slug) ?? '');
}
