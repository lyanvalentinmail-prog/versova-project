import { DEFAULT_PACK_SLUG, getPack, resolvePackSlug, type BotPack } from './bot-packs.js';

/**
 * Bot activo de la conexión de WhatsApp.
 *
 * Cada conexión habla un solo bot: el que está vinculado. El panel cambia este
 * valor cuando se vincula una instancia (`/api/subbots/:id/pair/confirm`) o al
 * pulsar «Usar este bot» en el catálogo. Se guarda en `settings` (clave
 * `active-bot`), así que sobrevive a los reinicios; `BOT_TYPE` define el valor
 * inicial cuando todavía no hay nada guardado.
 */

let activeSlug = resolvePackSlug(process.env.BOT_TYPE) ?? DEFAULT_PACK_SLUG;
let activeSubBotId: number | null = null;

export const ACTIVE_BOT_KEY = 'active-bot';

export interface ActiveBotState {
  slug: string;
  subbotId: number | null;
}

export function getActiveBotSlug(): string {
  return activeSlug;
}

export function getActiveBot(): BotPack {
  return getPack(activeSlug) ?? getPack(DEFAULT_PACK_SLUG)!;
}

export function getActiveBotState(): ActiveBotState {
  return { slug: activeSlug, subbotId: activeSubBotId };
}

/** Cambia el bot activo. Ignora slugs desconocidos y devuelve el slug aplicado. */
export function setActiveBot(slug: string | null | undefined, subbotId: number | null = null): string {
  const resolved = resolvePackSlug(slug);
  if (resolved) {
    activeSlug = resolved;
    activeSubBotId = subbotId;
  } else if (!slug) {
    activeSlug = DEFAULT_PACK_SLUG;
    activeSubBotId = null;
  }
  return activeSlug;
}
