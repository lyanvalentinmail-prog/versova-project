import pg from 'pg';
import type { PoolClient } from 'pg';
import { config } from '../config/index.js';
import { SCHEMA_SQL, SCHEMA_VERSION } from './schema.js';
import { logger } from '../utils/logger.js';

/**
 * En modo memoria (sin DATABASE_URL) la plataforma funciona igual, pero los
 * datos viven en RAM: sirve para probar la web sin levantar PostgreSQL.
 */
export const memoryMode = config.database.memory;

const rejected = (): never => {
  throw new Error('No hay base de datos configurada (modo memoria). Define DATABASE_URL para guardar los datos.');
};

const memoryClient = {
  query: rejected,
  release: () => undefined,
} as unknown as PoolClient;

export const pool: pg.Pool = memoryMode
  ? ({ query: rejected, end: async () => undefined, on: () => undefined } as unknown as pg.Pool)
  : new pg.Pool({
      connectionString: config.database.url,
      max: config.database.poolMax,
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 10_000,
      ssl: config.database.ssl ? { rejectUnauthorized: true } : false,
    });

if (!memoryMode) pool.on('error', (err) => logger.error('db', `Error en conexión inactiva: ${err.message}`));

/** Crea/actualiza el esquema. Usa un candado para que dos procesos no migren a la vez. */
export async function migrate(): Promise<void> {
  if (memoryMode) {
    logger.warn('db', 'Sin DATABASE_URL: la plataforma arranca en MODO MEMORIA (los datos no se guardan).');
    return;
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Transaction-scoped lock also works with Neon/PgBouncer pooled connections.
    await client.query('SELECT pg_advisory_xact_lock(7101)');
    await client.query(SCHEMA_SQL);
    await client.query(
      `CREATE TABLE IF NOT EXISTS schema_migrations (
         version INTEGER PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())`,
    );
    await client.query(
      'INSERT INTO schema_migrations (version) VALUES ($1) ON CONFLICT DO NOTHING',
      [SCHEMA_VERSION],
    );
    const { seedPlatform } = await import('./seed.js');
    await seedPlatform(client);
    await client.query('COMMIT');
    logger.info('db', `Esquema listo (versión ${SCHEMA_VERSION}).`);
  } catch (err) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
}

/** Ejecuta una función dentro de una transacción. */
export async function tx<T>(fn: (c: PoolClient) => Promise<T>): Promise<T> {
  if (memoryMode) return fn(memoryClient);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
}
