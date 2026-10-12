/**
 * 👑 VÉRSOVA — bot base de la plataforma.
 *
 * Sus 34 comandos viven en `src/commands/` (registro, personajes, equipo,
 * administración…). Este pack solo aporta la ficha del catálogo, para que el
 * panel y el asistente traten a los tres bots por igual.
 */
import { registerPack, type BotPack } from '../../src/core/bot-packs.js';

export const VERSOVA_PACK: BotPack = {
  slug: 'versova',
  aliases: ['versova', 'versova-rol', 'principal'],
  name: 'VÉRSOVA Rol',
  emoji: '👑',
  tagline: 'El bot completo para teams de rol',
  description:
    'Registro, personajes, parejas, advertencias, reglas, anuncios y administración del grupo. Es el bot principal de la plataforma y viene activo por defecto.',
  category: 'Team & Rol',
  accent: '#8b5cf6',
  link: 'https://github.com/lyanvalentinmail-prog/versova-project',
  prefix: '.',
  folder: 'src/commands',
  features: [
    'Registro y fichas con edad y personaje',
    'Solicitudes de personaje con aprobación',
    'Parejas, ships y perfiles sociales',
    'Advertencias, bans y anuncios',
    'Menú de 34 comandos con prefijo propio',
  ],
  highlights: ['menu', 'reg', 'rol', 'ficha', 'perfil', 'pareja', 'warn', 'anuncio'],
};

registerPack(VERSOVA_PACK);
