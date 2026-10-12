/** Utilidades de texto compartidas por los bots del catálogo. */

/** Une los argumentos de un comando conservando los espacios internos. */
export function joinArgs(args: string[]): string {
  return args.join(' ').trim();
}

/** Quita los signos decorativos del principio (por ejemplo `⚡`, `-`, `*`) y normaliza espacios. */
export function cleanText(raw: string, max = 300): string {
  return raw.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}

/** Elección pseudoaleatoria determinista para que un texto salga igual en las pruebas. */
export function pick<T>(items: readonly T[], seed: number): T {
  const index = Math.abs(Math.trunc(seed)) % items.length;
  return items[index]!;
}

/** Porcentaje entero entre 0 y 100 a partir de dos cadenas (para los «ship»). */
export function compatibility(a: string, b: string): number {
  const [x, y] = [a, b].sort();
  let hash = 7;
  for (const char of `${x}|${y}`) hash = (hash * 31 + char.charCodeAt(0)) % 100000;
  return (hash % 61) + 35;
}

/** Formatea una duración en milisegundos como `1 h 5 min` o `42 s`. */
export function humanDuration(ms: number): string {
  const seconds = Math.max(0, Math.round(ms / 1000));
  if (seconds < 60) return `${seconds} s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ${seconds % 60} s`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ${minutes % 60} min`;
  const days = Math.floor(hours / 24);
  return `${days} d ${hours % 24} h`;
}
