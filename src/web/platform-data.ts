/**
 * Datos base de la plataforma: catálogo de bots (gratis y de pago), tienda de
 * monedas, servidores de instancias y contenido de las secciones públicas.
 *
 * Estos datos se siembran en PostgreSQL (modo normal) y se usan tal cual en el
 * modo memoria (sin base de datos), para que la plataforma funcione igual en
 * los dos escenarios.
 */

export type BotPricing = 'free' | 'coins' | 'usd';

export interface CatalogBot {
  slug: string;
  name: string;
  emoji: string;
  tagline: string;
  description: string;
  category: string;
  pricing: BotPricing;
  priceCoins: number;
  priceUsd: number;
  badge: string | null;
  accent: string;
  features: string[];
  commands: string[];
  popularity: number;
  featured: boolean;
  sort: number;
  /** Repositorio del bot en GitHub (código abierto de la instancia). */
  link: string;
}

export interface PlatformServer {
  id: string;
  name: string;
  provider: string;
  region: string;
  capacity: number;
  used: number;
  cpu: number;
  ram: number;
  disk: number;
  status: 'online' | 'full' | 'maintenance';
  ip: string;
}

export const BOT_CATALOG: CatalogBot[] = [
  {
    slug: 'versova',
    name: 'VÉRSOVA Rol',
    emoji: '👑',
    tagline: 'El bot completo para teams de rol',
    description:
      'Registro, personajes, parejas, advertencias, reglas, anuncios y administración del grupo. Es el bot principal de la plataforma y viene activo por defecto.',
    category: 'Team & Rol',
    pricing: 'free',
    priceCoins: 0,
    priceUsd: 0,
    badge: 'GRATIS',
    accent: '#8b5cf6',
    features: [
      'Registro y fichas con edad y personaje',
      'Solicitudes de personaje con aprobación',
      'Parejas, ships y perfiles sociales',
      'Advertencias, bans y anuncios',
      'Menú de 33 comandos con prefijo propio',
    ],
    commands: ['menu', 'reg', 'unreg', 'rol', 'roles', 'ficha', 'editar', 'mirol', 'cambiarol', 'reservar', 'liberar'],
    popularity: 100,
    featured: true,
    sort: 1,
    link: 'https://github.com/lyanvalentinmail-prog/versova-project',
  },
  {
    slug: 'raiden',
    name: 'Raiden WaBot',
    emoji: '⚡',
    tagline: 'Bot anime completo: descargas, stickers, IA y más',
    description:
      'Bot de WhatsApp en Node.js + Baileys inspirado en Raiden (Genshin Impact). Descargas de Instagram, YouTube, Spotify y TikTok; stickers con estilo BRAT; IA conversacional; más de 40 reacciones anime; generador de logos y herramientas de administración. Código abierto en GitHub.',
    category: 'Juegos',
    pricing: 'free',
    priceCoins: 0,
    priceUsd: 0,
    badge: 'GRATIS',
    accent: '#6366f1',
    features: [
      'Descargas: Instagram, YouTube, Spotify, TikTok y letras',
      'Stickers: creación, estilo BRAT y Sticker.ly',
      'Más de 40 comandos de reacciones anime',
      'IA conversacional y generación de logos (neón, glitch, gaming)',
      'Administración: antilink, mute, tagall, abrir/cerrar grupo',
      'Perfil social: matrimonio, cumpleaños, foto de perfil',
    ],
    commands: ['menu', 'ping', 'download', 'sticker', 'marry', 'antilink', 'work', 'logo', 'ai'],
    popularity: 86,
    featured: true,
    sort: 2,
    link: 'https://github.com/Ryuzei-Ts/Raiden-WaBot',
  },
  {
    slug: 'yae-miku',
    name: 'Yae Miku Bot',
    emoji: '🎧',
    tagline: 'Bot de rol y moderación con sub-bots',
    description:
      'Bot de WhatsApp abierto en GitHub (MIT) del equipo Abrahan986: matrimonio y divorcio con pareja visible en el perfil, antilink que elimina enlaces y expulsa al remitente, sub-bots guardados que se restauran al conectar y herramientas de moderación. Código abierto en GitHub.',
    category: 'Juegos',
    pricing: 'free',
    priceCoins: 0,
    priceUsd: 0,
    badge: 'GRATIS',
    accent: '#22d3ee',
    features: [
      'Matrimonio/divorcio con pareja visible en el perfil',
      'Antilink: borra enlaces y expulsa al que los envíe',
      'Sub-bots persistentes: se restauran al reconectar',
      'Moderación de grupos y comandos sociales',
      'Licencia MIT: revisa y adapta el código en GitHub',
    ],
    commands: ['menu', 'marry', 'divorce', 'antilink', 'profile', 'config'],
    popularity: 74,
    featured: true,
    sort: 3,
    link: 'https://github.com/Abrahan987/Yae-Miku-Bot',
  },
];

export const PLATFORM_SERVERS: PlatformServer[] = [
  { id: 'vrsov-01', name: 'Vrsov Srv Asuna', provider: 'Versova Cloud', region: 'Asunción', capacity: 90, used: 80, cpu: 34, ram: 58, disk: 41, status: 'online', ip: '10.20.0.11' },
  { id: 'vrsov-02', name: 'Vrsov Srv Kirito', provider: 'Versova Cloud', region: 'Buenos Aires', capacity: 90, used: 61, cpu: 27, ram: 46, disk: 38, status: 'online', ip: '10.20.0.12' },
  { id: 'vrsov-03', name: 'Vrsov Srv Rem', provider: 'Versova Cloud', region: 'Montevideo', capacity: 60, used: 60, cpu: 72, ram: 81, disk: 63, status: 'full', ip: '10.20.0.13' },
  { id: 'vrsov-04', name: 'Vrsov Srv Zero Two', provider: 'Versova Cloud', region: 'Bogotá', capacity: 120, used: 47, cpu: 22, ram: 39, disk: 29, status: 'online', ip: '10.20.0.14' },
  { id: 'vrsov-05', name: 'Vrsov Srv Mikasa', provider: 'Versova Cloud', region: 'Santiago', capacity: 120, used: 88, cpu: 51, ram: 67, disk: 52, status: 'online', ip: '10.20.0.15' },
  { id: 'vrsov-06', name: 'Vrsov Srv Mai', provider: 'Versova Cloud', region: 'Lima', capacity: 60, used: 12, cpu: 14, ram: 26, disk: 19, status: 'maintenance', ip: '10.20.0.16' },
];

/** Instancias que se pueden elegir al registrar un bot (paso 1 del asistente). */
export const INSTANCE_TYPES = [
  { id: 'subbot', name: 'SubBot Gratis', description: 'Instancia gratuita básica', tier: 'free' as const, requiresToken: false, spaceGb: 1, emoji: '🤖' },
  { id: 'principal', name: 'Principal', description: 'Requiere token de moderador', tier: 'premium' as const, requiresToken: true, spaceGb: 2, emoji: '👑' },
  { id: 'premium', name: 'Premium', description: 'Beneficios exclusivos', tier: 'premium' as const, requiresToken: true, spaceGb: 2, emoji: '💎' },
  { id: 'vip', name: 'VIP', description: 'Todo ilimitado y prioridad', tier: 'vip' as const, requiresToken: true, spaceGb: 4, emoji: '🚀' },
];

export const OFFICIAL_LINKS = [
  { title: 'Canal de WhatsApp', description: 'Avisos sobre futuras actualizaciones', href: '/links#canal', emoji: '📣' },
  { title: 'Grupo de soporte', description: 'Ayuda directa del equipo', href: '/links#soporte', emoji: '💬' },
  { title: 'Panel de control', description: 'Administra tus bots y tus tokens', href: '/bots', emoji: '🎛️' },
  { title: 'Catálogo de bots', description: 'Activa bots gratis o de pago', href: '/store#catalogo', emoji: '🧩' },
  { title: 'Comandos', description: 'Todos los comandos y categorías', href: '/cmds', emoji: '⌘' },
  { title: 'Estado del sistema', description: 'Telemetría y servidores en vivo', href: '/metrics', emoji: '📈' },
];

export const PREFIX_CHOICES = ['/', '#', '!', '+', '-', '.', '*', '~'] as const;

export const BOT_OWNER_FALLBACK = 'Sin asignar';

export function catalogBotBySlug(slug: string): CatalogBot | null {
  return BOT_CATALOG.find((bot) => bot.slug === slug) ?? null;
}
