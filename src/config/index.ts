const onlyDigits = (s: string): string => s.replace(/\D/g, '');

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Falta la variable de entorno ${name}. Revisa .env.example.`);
  return value;
}

/**
 * La base de datos es opcional: sin DATABASE_URL la plataforma arranca en modo
 * memoria (todo funciona, pero los datos se pierden al reiniciar).
 */
const databaseUrl = process.env.DATABASE_URL?.trim() ?? '';

export const config = {
  bot: {
    name: 'VÉRSOVA',
    team: '◢禍◣ Versova ࿙☕࿚',
    prefix: '.',
    version: '1.0',
    timezone: 'America/Montevideo',
    locale: 'es-UY',
  },
  database: {
    url: databaseUrl,
    memory: databaseUrl.length === 0,
    ssl: process.env.DB_SSL !== 'false',
    poolMax: Number(process.env.DB_POOL_MAX ?? 8),
  },
  server: {
    port: Number(process.env.PORT ?? 3000),
  },
  owners: (() => {
    const fromEnv = (process.env.OWNER_NUMBERS ?? '').split(',').map(onlyDigits).filter(Boolean);
    // El owner por defecto de la plataforma: a él van los tickets.
    return fromEnv.length ? fromEnv : ['59896719709'];
  })(),
  /** Correo del owner donde se mandan los tickets. */
  ownerEmail: process.env.OWNER_EMAIL?.trim() || 'lyanvalentinmail@gmail.com',
  pairingPhone: onlyDigits(process.env.BOT_PHONE ?? ''),
  /** SMTP opcional para el aviso de tickets por email. Sin él solo se avisa por WhatsApp. */
  mail: {
    host: process.env.MAIL_HOST?.trim() ?? '',
    port: Number(process.env.MAIL_PORT ?? 587),
    secure: process.env.MAIL_SECURE === 'true',
    user: process.env.MAIL_USER?.trim() ?? '',
    pass: process.env.MAIL_PASS ?? '',
    from: process.env.MAIL_FROM?.trim() ?? 'Versova <no-reply@versova.app>',
  },
  defaults: {
    inactivityDays: 7,
    minAge: 1,
    maxAge: 120,
    nameMaxLength: 30,
    reservationHours: 24,
    warnLimit: 3,
    rateLimit: { max: 5, windowMs: 10_000 },
    confirmWord: 'si',
    maxBannerBytes: 1_500_000,
  },
} as const;
