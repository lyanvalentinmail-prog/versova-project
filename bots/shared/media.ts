/**
 * Imágenes de los bots del catálogo: stickers y logos.
 *
 * La conversión a WebP la hace `sharp` **si está instalado** (dependencia
 * opcional: `npm i sharp`). Sin `sharp` el bot sigue funcionando: reenvía los
 * stickers que ya están en WebP y manda los demás archivos como documento, en vez
 * de fallar.
 */
import { downloadMediaMessage, normalizeMessageContent, type WAMessage } from '@whiskeysockets/baileys';
import { logger } from '../../src/utils/logger.js';

type SharpFactory = (typeof import('sharp'))['default'];

let sharpCache: SharpFactory | null | undefined;

/** Carga `sharp` una sola vez. Devuelve null si no está instalado. */
export async function optionalSharp(): Promise<SharpFactory | null> {
  if (sharpCache !== undefined) return sharpCache;
  try {
    // Import dinámico por nombre: `sharp` es opcional y el proyecto compila sin él.
    const moduleName = 'sharp';
    const module = (await import(moduleName)) as unknown as { default?: SharpFactory } & SharpFactory;
    sharpCache = (module.default ?? module) as SharpFactory;
  } catch {
    sharpCache = null;
    logger.info('bots', 'sharp no está instalado: los stickers aceptan imágenes y videos en WebP.');
  }
  return sharpCache;
}

export function sharpAvailable(): Promise<boolean> {
  return optionalSharp().then(Boolean);
}

export interface QuotedMedia {
  buffer: Buffer;
  mimetype: string;
  kind: 'image' | 'video' | 'audio' | 'sticker' | 'document';
  fileName: string;
}

/** Media del mensaje citado (o del propio mensaje si trae imagen/video). */
export async function quotedMedia(msg: WAMessage, quotedId: string | null): Promise<QuotedMedia | null> {
  const content = normalizeMessageContent(msg.message);
  const quotedRaw = content?.extendedTextMessage?.contextInfo?.quotedMessage;

  // 1) Prioridad al mensaje citado (es lo que hace un usuario con «responder»).
  if (quotedId && quotedRaw) {
    const quoted = normalizeMessageContent(quotedRaw);
    const kind = mediaKind(quoted);
    if (!kind) return null;
    return downloadMedia({ key: msg.key, message: quoted } as WAMessage, kind, quoted);
  }

  // 2) Si no hay cita, se usa el propio mensaje (imagen o video con leyenda).
  const kind = mediaKind(content);
  if (!kind) return null;
  return downloadMedia(msg, kind, content);
}

function mediaKind(message: ReturnType<typeof normalizeMessageContent>): QuotedMedia['kind'] | null {
  if (!message) return null;
  if (message.imageMessage) return 'image';
  if (message.videoMessage) return 'video';
  if (message.audioMessage) return 'audio';
  if (message.stickerMessage) return 'sticker';
  if (message.documentMessage) return 'document';
  return null;
}

async function downloadMedia(
  source: WAMessage,
  kind: QuotedMedia['kind'],
  content: ReturnType<typeof normalizeMessageContent>,
): Promise<QuotedMedia | null> {
  try {
    const buffer = (await downloadMediaMessage(source, 'buffer', {})) as Buffer;
    return {
      buffer,
      mimetype: mediaMimetype(kind, content),
      kind,
      fileName: content?.documentMessage?.fileName ?? `versova-${kind}`,
    };
  } catch (err) {
    logger.warn('media', `No se pudo descargar el archivo citado: ${(err as Error).message}`);
    return null;
  }
}

function mediaMimetype(kind: QuotedMedia['kind'], content: ReturnType<typeof normalizeMessageContent>): string {
  const fromMessage =
    content?.imageMessage?.mimetype ??
    content?.videoMessage?.mimetype ??
    content?.audioMessage?.mimetype ??
    content?.stickerMessage?.mimetype ??
    content?.documentMessage?.mimetype;
  if (fromMessage) return fromMessage;
  switch (kind) {
    case 'image':
      return 'image/jpeg';
    case 'video':
      return 'video/mp4';
    case 'audio':
      return 'audio/mp4';
    case 'sticker':
      return 'image/webp';
    default:
      return 'application/octet-stream';
  }
}

/** Convierte cualquier imagen (o el primer fotograma de un video) a WebP para pegatina. */
export async function toStickerWebp(buffer: Buffer, kind: QuotedMedia['kind']): Promise<Buffer | null> {
  const sharp = await optionalSharp();
  if (!sharp) return kind === 'sticker' ? buffer : null;
  try {
    if (kind === 'video') {
      return await sharp(buffer, { animated: false })
        .resize(512, 512, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 82 })
        .toBuffer();
    }
    if (kind === 'image' || kind === 'sticker') {
      return await sharp(buffer, { animated: kind === 'sticker' })
        .resize(512, 512, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 84 })
        .toBuffer();
    }
    return null;
  } catch (err) {
    logger.warn('media', `No se pudo convertir a WebP: ${(err as Error).message}`);
    return null;
  }
}

/** ¿El buffer ya es un WebP válido? (RIFF….WEBP) */
export function isWebp(buffer: Buffer): boolean {
  return buffer.length > 12 && buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP';
}

/* -------------------------------- logos SVG -------------------------------- */

export type LogoStyle = 'neon' | 'glitch' | 'gaming' | 'gold' | 'fire';

interface StyleSpec {
  from: string;
  to: string;
  glow: string;
  fontFamily: string;
  letterSpacing: number;
  transform: string;
  extra: (text: string, x: number, y: number) => string;
}

const STYLE_SPECS: Record<LogoStyle, StyleSpec> = {
  neon: {
    from: '#8b5cf6',
    to: '#22d3ee',
    glow: '#a855f7',
    fontFamily: 'Impact, "Arial Black", sans-serif',
    letterSpacing: 4,
    transform: '',
    extra: () => '',
  },
  glitch: {
    from: '#f43f5e',
    to: '#06b6d4',
    glow: '#f43f5e',
    fontFamily: 'Impact, "Arial Black", sans-serif',
    letterSpacing: 3,
    transform: '',
    extra: (text, x, y) =>
      `<text x="${x - 6}" y="${y}" fill="#22d3ee" opacity="0.65" font-size="96" font-family="Impact, sans-serif">${text}</text>` +
      `<text x="${x + 6}" y="${y + 5}" fill="#f43f5e" opacity="0.65" font-size="96" font-family="Impact, sans-serif">${text}</text>`,
  },
  gaming: {
    from: '#8b5cf6',
    to: '#111827',
    glow: '#6366f1',
    fontFamily: '"Trebuchet MS", Impact, sans-serif',
    letterSpacing: 6,
    transform: 'skewX(-6)',
    extra: () => '',
  },
  gold: {
    from: '#fbbf24',
    to: '#b45309',
    glow: '#f59e0b',
    fontFamily: 'Georgia, "Times New Roman", serif',
    letterSpacing: 8,
    transform: '',
    extra: () => '',
  },
  fire: {
    from: '#f97316',
    to: '#dc2626',
    glow: '#fb923c',
    fontFamily: 'Impact, "Arial Black", sans-serif',
    letterSpacing: 5,
    transform: '',
    extra: () => '',
  },
};

export const LOGO_STYLES = Object.keys(STYLE_SPECS) as LogoStyle[];

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** Genera el logo como SVG (1024×512). El texto se escapa: nada de inyecciones. */
export function logoSvg(rawText: string, style: LogoStyle = 'neon'): string {
  const spec = STYLE_SPECS[style] ?? STYLE_SPECS.neon;
  const text = escapeXml(rawText.toUpperCase().slice(0, 18));
  const size = Math.min(96, Math.max(46, Math.floor(900 / Math.max(4, text.length))));
  const id = `g-${style}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="512" viewBox="0 0 1024 512">
  <defs>
    <linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${spec.from}"/>
      <stop offset="100%" stop-color="${spec.to}"/>
    </linearGradient>
    <filter id="glow">
      <feGaussianBlur stdDeviation="8" result="blur"/>
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>
  <rect width="1024" height="512" fill="#050506"/>
  <rect x="24" y="24" width="976" height="464" rx="28" fill="none" stroke="${spec.glow}" stroke-opacity="0.55" stroke-width="3"/>
  ${spec.extra(text, 512, 286)}
  <text x="512" y="272" text-anchor="middle" fill="url(#${id})" font-family="${spec.fontFamily}"
        font-size="${size}" letter-spacing="${spec.letterSpacing}" filter="url(#glow)"
        transform="translate(512 272) ${spec.transform} translate(-512 -272)">${text}</text>
  <text x="512" y="404" text-anchor="middle" fill="#c4b5fd" font-family="Verdana, sans-serif" font-size="22" letter-spacing="6">
    VÉRSOVA · BOTS
  </text>
</svg>`;
}

/** SVG → PNG con `sharp` (null si no está instalado). */
export async function svgToPng(svg: string): Promise<Buffer | null> {
  const sharp = await optionalSharp();
  if (!sharp) return null;
  try {
    return await sharp(Buffer.from(svg)).png().toBuffer();
  } catch (err) {
    logger.warn('media', `No se pudo rasterizar el logo: ${(err as Error).message}`);
    return null;
  }
}
