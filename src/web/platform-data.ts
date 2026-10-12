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
  {
    slug: 'moderador',
    name: 'Moderador Pro',
    emoji: '🛡️',
    tagline: 'Antilink, antispam y control total',
    description:
      'Bloquea enlaces, detecta spam y administra el grupo automáticamente. Expulsa, banea y devuelve integrantes con un solo comando.',
    category: 'Moderación',
    pricing: 'free',
    priceCoins: 0,
    priceUsd: 0,
    badge: 'GRATIS',
    accent: '#22c55e',
    features: [
      'Antilink y antispam configurables',
      'Advertencias automáticas con límite',
      'Expulsión, ban y desban con auditoría',
      'Apertura y cierre del grupo',
    ],
    commands: ['add', 'expulsar', 'ban', 'unban', 'warn', 'unwarn', 'close', 'open', 'admins'],
    popularity: 88,
    featured: true,
    sort: 2,
  },
  {
    slug: 'economia',
    name: 'Economía V-Coin',
    emoji: '🪙',
    tagline: 'Monedas, tienda y ranking',
    description:
      'Le da monedas a tu grupo: trabajo, ruleta, robos con cooldown, tienda interna y ranking de los más ricos. También sirve para la economía de la plataforma.',
    category: 'Economía',
    pricing: 'coins',
    priceCoins: 400,
    priceUsd: 3,
    badge: 'POPULAR',
    accent: '#f59e0b',
    features: [
      'Monedero por integrante y por grupo',
      'Trabajo, diario, ruleta y robo',
      'Tienda interna con objetos',
      'Ranking global de riqueza',
    ],
    commands: ['coins', 'daily', 'work', 'robar', 'rank', 'tienda', 'comprar'],
    popularity: 95,
    featured: true,
    sort: 3,
  },
  {
    slug: 'ia',
    name: 'IA Assistant',
    emoji: '🤖',
    tagline: 'ChatGPT dentro de tu grupo',
    description:
      'Responde preguntas, resume conversaciones, traduce y genera textos o imágenes. Se activa escrito el comando o respondiendo a un mensaje.',
    category: 'Inteligencia',
    pricing: 'coins',
    priceCoins: 900,
    priceUsd: 5,
    badge: 'IA',
    accent: '#06b6d4',
    features: [
      'Respuestas en español e inglés',
      'Resumen de conversaciones largas',
      'Traducción instantánea',
      'Generación de imágenes',
    ],
    commands: ['ia', 'gpt', 'resumen', 'traducir', 'imagen'],
    popularity: 91,
    featured: true,
    sort: 4,
  },
  {
    slug: 'musica',
    name: 'Música & Radio',
    emoji: '🎵',
    tagline: 'Reproduce música en el grupo',
    description:
      'Descarga audio de tus enlaces favoritos y lo envía como nota de voz o archivo. Incluye radio 24/7 y listas compartidas.',
    category: 'Música',
    pricing: 'coins',
    priceCoins: 600,
    priceUsd: 4,
    badge: null,
    accent: '#ec4899',
    features: ['Descarga de audio por enlace', 'Radio 24/7', 'Listas colaborativas', 'Letras sincronizadas'],
    commands: ['play', 'audio', 'radio', 'letra', 'playlist'],
    popularity: 76,
    featured: false,
    sort: 5,
  },
  {
    slug: 'juegos',
    name: 'Juegos & Trivia',
    emoji: '🎮',
    tagline: 'Minijuegos para romper el hielo',
    description:
      'Trivia, ahorcado, dados, tic tac toe, preguntas de rol y torneos por grupos con premios en monedas.',
    category: 'Juegos',
    pricing: 'coins',
    priceCoins: 350,
    priceUsd: 2,
    badge: null,
    accent: '#a855f7',
    features: ['Trivia con premios', 'Ahorcado y dados', 'Torneos por equipos', 'Ranking de jugadores'],
    commands: ['trivia', 'ahorcado', 'dados', 'ppt', 'torneo'],
    popularity: 70,
    featured: false,
    sort: 6,
  },
  {
    slug: 'stickers',
    name: 'Stickers Studio',
    emoji: '🎨',
    tagline: 'Crea stickers desde fotos y videos',
    description:
      'Convierte imágenes, videos y GIFs en stickers, quita fondos, recorta y añade texto. También hace emojis personalizados.',
    category: 'Utilidades',
    pricing: 'free',
    priceCoins: 0,
    priceUsd: 0,
    badge: 'GRATIS',
    accent: '#14b8a6',
    features: ['Foto y video a sticker', 'Recorte y fondo transparente', 'Texto sobre stickers', 'Paquetes por grupo'],
    commands: ['sticker', 's', 'attp', 'emojimix', 'toimg'],
    popularity: 84,
    featured: false,
    sort: 7,
  },
  {
    slug: 'descargas',
    name: 'Descargas Multi',
    emoji: '📥',
    tagline: 'Video y audio de todas las redes',
    description:
      'Descarga video o audio desde TikTok, Instagram, YouTube, Twitter y Facebook con un solo comando y calidad configurable.',
    category: 'Utilidades',
    pricing: 'free',
    priceCoins: 0,
    priceUsd: 0,
    badge: 'GRATIS',
    accent: '#3b82f6',
    features: ['TikTok, IG, YouTube y más', 'Audio o video', 'Calidad seleccionable', 'Sin marca de agua'],
    commands: ['ytmp4', 'ytmp3', 'tiktok', 'ig', 'fb'],
    popularity: 82,
    featured: false,
    sort: 8,
  },
  {
    slug: 'bienvenidas',
    name: 'Bienvenidas & Despedidas',
    emoji: '🎉',
    tagline: 'Recibe a los nuevos con estilo',
    description:
      'Mensajes e imágenes de bienvenida personalizables, contador de integrantes, despedidas y antidepuración de inactivos.',
    category: 'Moderación',
    pricing: 'free',
    priceCoins: 0,
    priceUsd: 0,
    badge: 'GRATIS',
    accent: '#f97316',
    features: ['Bienvenida con imagen', 'Despedida automática', 'Contador de miembros', 'Purga de inactivos'],
    commands: ['bienvenida', 'despedida', 'setwelcome', 'inactivos', 'purga'],
    popularity: 68,
    featured: false,
    sort: 9,
  },
  {
    slug: 'encuestas',
    name: 'Encuestas & Sorteos',
    emoji: '📊',
    tagline: 'Decisiones del team en segundos',
    description:
      'Crea encuestas con votos en vivo, sorteos con requisitos y lista de participantes, y recordatorios para eventos del team.',
    category: 'Team & Rol',
    pricing: 'free',
    priceCoins: 0,
    priceUsd: 0,
    badge: 'GRATIS',
    accent: '#eab308',
    features: ['Encuestas con botones', 'Sorteos con requisitos', 'Recordatorios programados', 'Resultados en vivo'],
    commands: ['encuesta', 'sorteo', 'recordar', 'votar'],
    popularity: 64,
    featured: false,
    sort: 10,
  },
  {
    slug: 'ventas',
    name: 'Catálogo de Ventas',
    emoji: '🛒',
    tagline: 'Vende dentro de WhatsApp',
    description:
      'Catálogo de productos, carrito, pedidos con confirmación y envío de datos de pago. Ideal para ventas de rol o servicios.',
    category: 'Economía',
    pricing: 'usd',
    priceCoins: 1500,
    priceUsd: 8,
    badge: 'PRO',
    accent: '#ef4444',
    features: ['Catálogo con imágenes', 'Carrito y pedidos', 'Estados de entrega', 'Historial de ventas'],
    commands: ['catalogo', 'pedido', 'pagar', 'entregar'],
    popularity: 59,
    featured: false,
    sort: 11,
  },
  {
    slug: 'auditoria',
    name: 'Auditoría & Logs',
    emoji: '🔎',
    tagline: 'Todo lo que pasa, registrado',
    description:
      'Registra cada acción administrativa, comandos usados y actividad del grupo. Exporta el historial cuando lo necesites.',
    category: 'Moderación',
    pricing: 'usd',
    priceCoins: 2200,
    priceUsd: 12,
    badge: 'PRO',
    accent: '#64748b',
    features: ['Log de administración', 'Estadísticas por integrante', 'Alertas al owner', 'Exportación CSV'],
    commands: ['logs', 'stats', 'reporte', 'exportar'],
    popularity: 48,
    featured: false,
    sort: 12,
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
