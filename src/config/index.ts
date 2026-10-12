const onlyDigits = (s: string): string => s.replace(/\D/g, '');

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Falta la variable de entorno ${name}. Revisa .env.example.`);
  return value;
}

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
    url: required('DATABASE_URL'),
    ssl: process.env.DB_SSL !== 'false',
    poolMax: Number(process.env.DB_POOL_MAX ?? 8),
  },
  server: {
    port: Number(process.env.PORT ?? 3000),
  },
  owners: (process.env.OWNER_NUMBERS ?? '')
    .split(',')
    .map(onlyDigits)
    .filter(Boolean),
  pairingPhone: onlyDigits(process.env.BOT_PHONE ?? ''),
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
