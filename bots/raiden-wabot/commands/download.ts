import { registerPackCommand, type Command, type Ctx } from '../../../src/core/bot-packs.js';
import { config } from '../../../src/config/index.js';
import { detectPlatform, isProbablyUrl, normalizeUrl, oembedEndpoint, youtubeSearchUrl, type PlatformInfo } from '../../shared/links.js';
import { externalDownload, linkMetadata, networkEnabled } from '../../shared/http.js';
import { cleanText, joinArgs } from '../../shared/text.js';
import { RAIDEN, raidenCard, raidenNote } from '../brand.js';

type MediaKind = 'video' | 'audio';

interface MediaTarget {
  url: string;
  platform: PlatformInfo;
  kind: MediaKind;
}

/** Interpreta el enlace y la preferencia (`video` o `audio`) del comando. */
function readTarget(ctx: Ctx, expected?: PlatformInfo['id']): MediaTarget | { error: string } {
  const raw = joinArgs(ctx.args);
  const match = raw.match(/(?:https?:\/\/|www\.)[^\s]+/i);
  const candidate = match ? match[0] : raw.split(/\s+/)[0] ?? '';
  if (!candidate || !isProbablyUrl(candidate)) {
    return {
      error: expected
        ? `Pásame un enlace de ${expected === 'otros' ? 'descarga' : expected} válido.`
        : 'Pásame un enlace válido: `.download https://…`',
    };
  }
  const url = normalizeUrl(candidate);
  const platform = detectPlatform(url);
  if (expected && platform.id !== expected && !(expected === 'youtube' && platform.id === 'youtube')) {
    const names: Record<string, string> = {
      youtube: 'YouTube',
      instagram: 'Instagram',
      tiktok: 'TikTok',
      spotify: 'Spotify',
      twitter: 'X/Twitter',
    };
    return { error: `Ese enlace parece de ${platform.name}. Este comando es para ${names[expected] ?? expected}.` };
  }
  const kind: MediaKind = /\b(audio|mp3|musica|música|song)\b/i.test(raw) || platform.id === 'spotify' ? 'audio' : 'video';
  return { url, platform, kind };
}

/** Descarga (con el descargador configurado) o entrega la tarjeta del enlace. */
async function deliver(ctx: Ctx, target: MediaTarget, rawArgs: string): Promise<void> {
  const metadata = await linkMetadata(target.url, oembedEndpoint(target.url));
  const wantsAudio = /\b(audio|mp3)\b/i.test(rawArgs) || target.kind === 'audio';
  const downloaded = await externalDownload(target.url, wantsAudio ? 'audio' : 'video');

  if (downloaded) {
    try {
      if (wantsAudio) {
        await ctx.sock.sendMessage(ctx.chat, {
          document: { url: downloaded.url },
          mimetype: 'audio/mpeg',
          fileName: `${downloaded.fileName || `${RAIDEN.short}-audio`}.mp3`,
          caption: raidenNote(`🎧 ${downloaded.title || metadata?.title || 'Audio listo'}`),
        });
      } else {
        await ctx.sock.sendMessage(ctx.chat, {
          document: { url: downloaded.url },
          mimetype: 'video/mp4',
          fileName: `${downloaded.fileName || `${RAIDEN.short}-video`}.mp4`,
          caption: raidenNote(`🎬 ${downloaded.title || metadata?.title || 'Video listo'}`),
        });
      }
      return;
    } catch (error) {
      await ctx.reply(raidenNote(`⚠️ El descargador devolvió un archivo que no pude enviar: ${(error as Error).message}`));
    }
  }

  const lines = [
    `Plataforma ⁙ ${target.platform.emoji} ${target.platform.name}`,
    metadata?.title ? `Título ⁙ ${cleanText(metadata.title, 90)}` : '',
    metadata?.author ? `Autor ⁙ ${cleanText(metadata.author, 60)}` : '',
    target.platform.hint,
    '',
    networkEnabled()
      ? 'Activa el descargador directo con `DOWNLOAD_API_URL` (por ejemplo una instancia de Cobalt) y este comando enviará el archivo.'
      : 'Las funciones de internet están apagadas (`BOT_ALLOW_NETWORK=0`).',
  ].filter(Boolean);

  await ctx.reply(raidenCard({
    title: wantsAudio ? 'Audio preparado' : 'Descarga preparada',
    emoji: target.platform.emoji,
    lines: [`Enlace ⁙ ${target.url}`, '', ...lines],
  }));
}

const download: Command = {
  name: 'download',
  category: 'Descargas',
  usage: '.download <enlace> [audio]',
  description: 'Descarga un video o audio de YouTube, Instagram, TikTok, Spotify o X.',
  async run(ctx) {
    const target = readTarget(ctx);
    if ('error' in target) {
      await ctx.reply(raidenNote(`⚡ ${target.error}`));
      return;
    }
    await deliver(ctx, target, joinArgs(ctx.args));
  },
};

function platformCommand(name: string, platformId: PlatformInfo['id'], aliases: string[] = []): Command {
  return {
    name,
    category: 'Descargas',
    usage: `.${name} <enlace>`,
    description: `Descarga contenido de ${platformId === 'twitter' ? 'X/Twitter' : platformId}.`,
    async run(ctx) {
      const target = readTarget(ctx, platformId);
      if ('error' in target) {
        await ctx.reply(raidenNote(`⚡ ${target.error}`));
        return;
      }
      await deliver(ctx, target, joinArgs(ctx.args));
    },
    ...(aliases.length ? {} : {}),
  };
}

const play: Command = {
  name: 'play',
  category: 'Descargas',
  usage: '.play <texto o enlace>',
  description: 'Busca una canción en YouTube y prepara el enlace de descarga.',
  async run(ctx) {
    const query = cleanText(joinArgs(ctx.args), 120);
    if (!query) {
      await ctx.reply(raidenNote('⚡ Dime qué quieres escuchar: `.play Raiden Shogun theme`'));
      return;
    }
    if (isProbablyUrl(query)) {
      const target = readTarget(ctx);
      if (!('error' in target)) {
        await deliver(ctx, target, query);
        return;
      }
    }
    await ctx.reply(raidenCard({
      title: 'Búsqueda lista',
      emoji: '🎧',
      lines: [
        `Consulta ⁙ ${query}`,
        `Buscar ⁙ ${youtubeSearchUrl(query)}`,
        '',
        config.bots.downloadApiUrl
          ? 'Copia el enlace del resultado y usa `.download <enlace> audio`.'
          : 'Configura `DOWNLOAD_API_URL` para que Raiden envíe el audio directamente.',
      ],
    }));
  },
};

registerPackCommand(
  RAIDEN.slug,
  download,
  play,
  platformCommand('yt', 'youtube'),
  platformCommand('ig', 'instagram'),
  platformCommand('tiktok', 'tiktok'),
  platformCommand('spotify', 'spotify'),
  platformCommand('xdl', 'twitter'),
);
