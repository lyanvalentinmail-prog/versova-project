/**
 * Peticiones HTTP de los bots del catálogo (metadatos y descargadores).
 *
 * Todas las llamadas tienen tiempo límite y fallan en silencio: si la instancia no
 * tiene salida a internet, el bot responde con una tarjeta informativa en vez de
 * dejar el comando colgado. `BOT_ALLOW_NETWORK=0` desactiva por completo las
 * peticiones externas (útil en pruebas o despliegues cerrados).
 */
import { config } from '../../src/config/index.js';

export interface FetchOptions {
  method?: 'GET' | 'POST';
  headers?: Record<string, string>;
  body?: unknown;
  timeoutMs?: number;
  maxBytes?: number;
}

export interface FetchResult {
  ok: boolean;
  status: number;
  text: string;
  json: <T = Record<string, unknown>>() => T | null;
}

const OFFLINE: FetchResult = {
  ok: false,
  status: 0,
  text: '',
  json: () => null,
};

export function networkEnabled(): boolean {
  return config.bots.allowNetwork;
}

/** GET/POST con tiempo límite. Nunca lanza: devuelve `ok: false` si algo falla. */
export async function request(url: string, options: FetchOptions = {}): Promise<FetchResult> {
  if (!networkEnabled()) return OFFLINE;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? config.bots.requestTimeoutMs);
  try {
    const response = await fetch(url, {
      method: options.method ?? 'GET',
      headers: {
        'user-agent': 'VersovaBots/1.0 (+https://github.com/lyanvalentinmail-prog/versova-project)',
        ...(options.body ? { 'content-type': 'application/json' } : {}),
        ...options.headers,
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
    });
    const raw = await response.text();
    const text = raw.slice(0, options.maxBytes ?? 200_000);
    return {
      ok: response.ok,
      status: response.status,
      text,
      json: <T>() => {
        try {
          return JSON.parse(text) as T;
        } catch {
          return null;
        }
      },
    };
  } catch {
    return OFFLINE;
  } finally {
    clearTimeout(timer);
  }
}

export interface LinkMetadata {
  title: string;
  author: string;
  thumbnail: string;
  provider: string;
}

/** Metadatos públicos del enlace (título, autor y miniatura) vía oEmbed. */
export async function linkMetadata(url: string, endpoint: string | null): Promise<LinkMetadata | null> {
  if (!endpoint) return null;
  const result = await request(endpoint, { timeoutMs: 4000, maxBytes: 40_000 });
  if (!result.ok) return null;
  const data = result.json<Record<string, unknown>>();
  if (!data) return null;
  const title = typeof data.title === 'string' ? data.title : '';
  if (!title) return null;
  return {
    title,
    author: typeof data.author_name === 'string' ? data.author_name : '',
    thumbnail: typeof data.thumbnail_url === 'string' ? data.thumbnail_url : '',
    provider: typeof data.provider_name === 'string' ? data.provider_name : '',
  };
}

export interface DownloadResult {
  url: string;
  kind: 'video' | 'audio' | 'image' | 'file';
  fileName: string;
  title: string;
}

/**
 * Descargador externo opcional (por ejemplo una instancia de Cobalt):
 * `DOWNLOAD_API_URL=https://mi-descargador/api/json`.
 * Sin esta variable el bot explica cómo activarlo en vez de inventar enlaces.
 */
export async function externalDownload(url: string, kind: 'video' | 'audio'): Promise<DownloadResult | null> {
  const api = config.bots.downloadApiUrl;
  if (!api || !networkEnabled()) return null;
  const result = await request(api, {
    method: 'POST',
    body: { url, downloadMode: kind === 'audio' ? 'audio' : 'auto' },
    timeoutMs: 12_000,
    maxBytes: 60_000,
  });
  if (!result.ok) return null;
  const data = result.json<Record<string, unknown>>();
  if (!data) return null;
  const direct = typeof data.url === 'string' ? data.url : '';
  if (!direct) return null;
  return {
    url: direct,
    kind,
    fileName: typeof data.filename === 'string' && data.filename ? data.filename : `versova-${kind}`,
    title: typeof data.title === 'string' ? data.title : '',
  };
}
