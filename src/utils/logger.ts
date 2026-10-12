import { EventEmitter } from 'node:events';

export type LogLevel = 'info' | 'warn' | 'error' | 'debug';

export interface LogEntry {
  time: string;
  level: LogLevel;
  scope: string;
  message: string;
}

const MAX_BUFFER = 500;
const buffer: LogEntry[] = [];

/** Bus para enviar logs en vivo a la consola web (SSE). */
export const logBus = new EventEmitter();
logBus.setMaxListeners(100);

/** Oculta cualquier cosa que parezca una clave o credencial antes de guardarla. */
function redact(text: string): string {
  return text.replace(/(password|key|token|secret|clave)\s*[=:]\s*\S+/gi, '$1=[oculto]');
}

export function log(level: LogLevel, scope: string, message: string): void {
  const entry: LogEntry = {
    time: new Date().toISOString(),
    level,
    scope,
    message: redact(message),
  };
  buffer.push(entry);
  if (buffer.length > MAX_BUFFER) buffer.shift();
  const line = `[${entry.time}] ${level.toUpperCase()} [${scope}] ${entry.message}`;
  if (level === 'error') console.error(line);
  else console.log(line);
  logBus.emit('log', entry);
}

export const logger = {
  info: (scope: string, message: string) => log('info', scope, message),
  warn: (scope: string, message: string) => log('warn', scope, message),
  error: (scope: string, message: string) => log('error', scope, message),
  debug: (scope: string, message: string) => log('debug', scope, message),
};

export const recentLogs = (): LogEntry[] => [...buffer];
