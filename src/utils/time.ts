import { config } from '../config/index.js';

const dateFormatter = new Intl.DateTimeFormat(config.bot.locale, {
  timeZone: config.bot.timezone,
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

export const formatDate = (date: Date | string | null | undefined): string =>
  date ? dateFormatter.format(new Date(date)) : '—';

/** Tiempo restante legible: "5 h 12 min" o "vencido". */
export function formatRemaining(until: Date | string): string {
  const ms = new Date(until).getTime() - Date.now();
  if (ms <= 0) return 'vencido';
  const totalMin = Math.floor(ms / 60_000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return h > 0 ? `${h} h ${m} min` : `${m} min`;
}

/** Días completos transcurridos desde una fecha. */
export function daysSince(date: Date | string): number {
  return Math.floor((Date.now() - new Date(date).getTime()) / 86_400_000);
}
