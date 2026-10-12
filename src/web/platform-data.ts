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
}

export interface CoinItem {
  id: string;
  name: string;
  description: string;
  priceCoins: number;
  kind: 'space' | 'token' | 'plan' | 'premium-feature';
  payload: Record<string, unknown>;
  badge: string | null;
  available: boolean;
  sort: number;
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

export const CATALOG_CATEGORIES = [
  'Todos',
  'Team & Rol',
  'Moderación',
  'Economía',
  'Inteligencia',
  'Música',
  'Juegos',
  'Utilidades',
] as const;

/** Moneda de la economía de la plataforma. */
export const COIN = { name: 'V-Coin', symbol: '🪙', prefix: 'V$' } as const;

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
  },
];

export const COIN_ITEMS: CoinItem[] = [
  {
    id: 'coin-space-1gb',
    name: '1 GB extra de espacio',
    description: 'Suma 1 GB al pool de tu cuenta y repártelo entre tus bots.',
    priceCoins: 300,
    kind: 'space',
    payload: { spaceGb: 1 },
    badge: null,
    available: true,
    sort: 1,
  },
  {
    id: 'coin-token-premium',
    name: 'Token Premium',
    description: 'Canjeable al crear un sub-bot Premium (2 GB dedicados).',
    priceCoins: 700,
    kind: 'token',
    payload: { tier: 'premium', spaceGb: 2 },
    badge: 'RECOMENDADO',
    available: true,
    sort: 2,
  },
  {
    id: 'coin-token-vip',
    name: 'Token VIP',
    description: 'Canjeable al crear un sub-bot VIP (4 GB dedicados).',
    priceCoins: 2500,
    kind: 'token',
    payload: { tier: 'vip', spaceGb: 4 },
    badge: null,
    available: true,
    sort: 3,
  },
  {
    id: 'coin-plan-premium',
    name: 'Plan Premium',
    description: 'Hasta 5 bots con 2 GB por bot y acceso anticipado a comandos.',
    priceCoins: 1200,
    kind: 'plan',
    payload: { plan: 'premium' },
    badge: null,
    available: true,
    sort: 4,
  },
  {
    id: 'coin-plan-vip',
    name: 'Plan VIP',
    description: 'Hasta 10 bots con 5 GB por bot, prioridad de soporte y todo ilimitado.',
    priceCoins: 4000,
    kind: 'plan',
    payload: { plan: 'vip' },
    badge: 'TOP',
    available: true,
    sort: 5,
  },
  {
    id: 'coin-banner-pack',
    name: 'Pack de banners',
    description: 'Banners animados listos para tu menú, más 3 subidas extra de imagen.',
    priceCoins: 150,
    kind: 'premium-feature',
    payload: { banners: 5 },
    badge: null,
    available: true,
    sort: 6,
  },
  {
    id: 'coin-prefix-pack',
    name: 'Pack de prefijos',
    description: 'Activa hasta 8 prefijos simultáneos (/, #, !, +, -, ., *, ~) en un bot.',
    priceCoins: 250,
    kind: 'premium-feature',
    payload: { prefixes: 8 },
    badge: null,
    available: true,
    sort: 7,
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

export interface MissionDefinition {
  id: string;
  name: string;
  description: string;
  reward: number;
}

export const MISSIONS: MissionDefinition[] = [
  { id: 'daily', name: 'Bono diario', description: 'Entra cada día y reclama tus monedas.', reward: 25 },
  { id: 'profile', name: 'Perfil completo', description: 'Pon nombre corto, moneda y canal en un bot.', reward: 60 },
  { id: 'first-bot', name: 'Primer bot', description: 'Crea tu primer bot en la plataforma.', reward: 100 },
  { id: 'first-catalog', name: 'Primer bot del catálogo', description: 'Activa cualquier bot del catálogo.', reward: 80 },
  { id: 'first-purchase', name: 'Primera compra', description: 'Compra algo en la tienda con V-Coins.', reward: 50 },
  { id: 'three-bots', name: 'Coleccionista', description: 'Ten 3 bots activos a la vez.', reward: 150 },
];

export interface Collaborator {
  name: string;
  role: string;
  handle: string;
  emoji: string;
}

export const COLLABORATORS: Collaborator[] = [
  { name: 'Versova Team', role: 'CEO', handle: 'https://web.stellarwa.xyz', emoji: 'V' },
  { name: 'Soporte 24/7', role: 'SOPORTE', handle: 'https://wa.me/598000000000', emoji: 'S' },
  { name: 'Moderación', role: 'SOCIO', handle: 'https://web.stellarwa.xyz', emoji: 'M' },
  { name: 'Comunidad', role: 'MODERADOR', handle: 'https://web.stellarwa.xyz', emoji: 'C' },
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
