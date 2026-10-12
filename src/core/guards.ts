import type { BotGuard, GuardCtx } from './bot-packs.js';

/**
 * Guardias: se ejecutan en cada mensaje del grupo (no solo en comandos) y son la
 * base de funciones como el antilink de Raiden WaBot y de Yae Miku Bot.
 *
 * Cada guardia pertenece a un pack, así que solo actúa cuando ese bot es el que
 * está activo en la conexión.
 */
const guards = new Map<string, BotGuard[]>();

export function registerGuard(pack: string, guard: BotGuard): void {
  const list = guards.get(pack) ?? [];
  if (list.some((entry) => entry.name === guard.name)) {
    throw new Error(`Guardia duplicada en ${pack}: ${guard.name}`);
  }
  list.push(guard);
  guards.set(pack, list);
}

export function guardsFor(pack: string): BotGuard[] {
  return [...(guards.get(pack) ?? [])];
}

export function allGuards(): Array<BotGuard & { pack: string }> {
  return [...guards.entries()].flatMap(([pack, list]) => list.map((guard) => ({ ...guard, pack })));
}

/**
 * Ejecuta las guardias del pack activo. Nunca lanza: una guardia rota no puede
 * tumbar el resto de la conversación.
 */
export async function runGuards(pack: string, ctx: GuardCtx, onError?: (err: unknown, guard: BotGuard) => void): Promise<void> {
  for (const guard of guardsFor(pack)) {
    try {
      await guard.run(ctx);
    } catch (err) {
      onError?.(err, guard);
    }
  }
}
