/**
 * Detección de enlaces y plataformas para los bots del catálogo.
 *
 * `.download` de Raiden WaBot y el antilink de todos los packs comparten estas
 * expresiones, así que las dos funciones ven exactamente los mismos enlaces.
 */

export const LINK_REGEX =
  /(?:https?:\/\/|www\.)[^\s]+|\b[a-z0-9][a-z0-9-]{1,61}\.(?:com|net|org|io|app|me|tv|gg|xyz|link|site|online|co|uy|ar|mx|es|cl|pe|br|ve|bo|py|ec)(?:\/[^\s]*)?/gi;

export type PlatformId =
  | 'youtube'
  | 'instagram'
  | 'tiktok'
  | 'spotify'
  | 'twitter'
  | 'facebook'
  | 'pinterest'
  | 'reddit'
  | 'otros';

export interface PlatformInfo {
  id: PlatformId;
  name: string;
  emoji: string;
  hint: string;
}

export const PLATFORMS: Record<PlatformId, PlatformInfo> = {
  youtube: { id: 'youtube', name: 'YouTube', emoji: '▶️', hint: 'Video o audio. Usa `.play <texto>` para buscar.' },
  instagram: { id: 'instagram', name: 'Instagram', emoji: '📸', hint: 'Reel, publicación o historia pública.' },
  tiktok: { id: 'tiktok', name: 'TikTok', emoji: '🎵', hint: 'Video con o sin marca de agua.' },
  spotify: { id: 'spotify', name: 'Spotify', emoji: '🎧', hint: 'Canción, álbum o lista de reproducción.' },
  twitter: { id: 'twitter', name: 'X / Twitter', emoji: '🐦', hint: 'Publicación con video.' },
  facebook: { id: 'facebook', name: 'Facebook', emoji: '📘', hint: 'Video público.' },
  pinterest: { id: 'pinterest', name: 'Pinterest', emoji: '📌', hint: 'Imagen o video.' },
  reddit: { id: 'reddit', name: 'Reddit', emoji: '👽', hint: 'Publicación con media.' },
  otros: { id: 'otros', name: 'Enlace general', emoji: '🔗', hint: 'Enlace compatible con el descargador.' },
};

/** Primer enlace del texto (o null si no hay). */
export function firstLink(text: string): string | null {
  LINK_REGEX.lastIndex = 0;
  const match = LINK_REGEX.exec(text);
  return match ? match[0] : null;
}

export function hasLink(text: string): boolean {
  return firstLink(text) !== null;
}

/** Plataforma de un enlace, para elegir el mensaje y el endpoint correctos. */
export function detectPlatform(url: string): PlatformInfo {
  const lower = url.toLowerCase();
  if (/youtu\.?be|youtube\./.test(lower)) return PLATFORMS.youtube;
  if (/instagram\./.test(lower)) return PLATFORMS.instagram;
  if (/tiktok\./.test(lower)) return PLATFORMS.tiktok;
  if (/spotify\./.test(lower)) return PLATFORMS.spotify;
  if (/twitter\.com|x\.com/.test(lower)) return PLATFORMS.twitter;
  if (/facebook\.|fb\.watch/.test(lower)) return PLATFORMS.facebook;
  if (/pin\.it|pinterest\./.test(lower)) return PLATFORMS.pinterest;
  if (/reddit\./.test(lower)) return PLATFORMS.reddit;
  return PLATFORMS.otros;
}

/** Añade el esquema si el usuario escribió el enlace sin `https://`. */
export function normalizeUrl(raw: string): string {
  const value = raw.trim();
  if (!value) return '';
  return /^https?:\/\//i.test(value) ? value : `https://${value}`;
}

/** Comprobación básica: un enlace con host y TLD reconocible. */
export function isProbablyUrl(raw: string): boolean {
  try {
    const url = new URL(normalizeUrl(raw));
    return Boolean(url.hostname) && url.hostname.includes('.');
  } catch {
    return false;
  }
}

/** Enlace de búsqueda de YouTube (lo usa `.play`). */
export function youtubeSearchUrl(query: string): string {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
}

/** Endpoints públicos de metadatos (oEmbed) por plataforma. */
export function oembedEndpoint(url: string): string | null {
  const platform = detectPlatform(url).id;
  const encoded = encodeURIComponent(url);
  switch (platform) {
    case 'youtube':
      return `https://www.youtube.com/oembed?url=${encoded}&format=json`;
    case 'tiktok':
      return `https://www.tiktok.com/oembed?url=${encoded}`;
    case 'spotify':
      return `https://open.spotify.com/oembed?url=${encoded}`;
    case 'twitter':
      return `https://publish.twitter.com/oembed?url=${encoded}`;
    case 'reddit':
      return `https://www.reddit.com/oembed?url=${encoded}`;
    default:
      return `https://noembed.com/embed?url=${encoded}`;
  }
}
