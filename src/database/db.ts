import pg from 'pg';
import { config } from '../config/index.js';
import { SCHEMA_SQL, SCHEMA_VERSION } from './schema.js';
import { logger } from '../utils/logger.js';

export const pool = new pg.Pool({
  connectionString: config.database.url,
  max: config.database.poolMax,
  ssl: config.database.ssl ? { rejectUnauthorized: true } : false,
});

pool.on('error', (err) => logger.error('db', `Error en conexión inactiva: ${err.message}`));

/** Crea/actualiza el esquema. Usa un candado para que dos procesos no migren a la vez. */
export async function migrate(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('SELECT pg_advisory_lock(7101)');
    await client.query('BEGIN');
    await client.query(SCHEMA_SQL);
    await client.query(
      `CREATE TABLE IF NOT EXISTS schema_migrations (
         version INTEGER PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())`,
    );
    await client.query(
      'INSERT INTO schema_migrations (version) VALUES ($1) ON CONFLICT DO NOTHING',
      [SCHEMA_VERSION],
    );
    await client.query('COMMIT');
    logger.info('db', `Esquema listo (versión ${SCHEMA_VERSION}).`);
  } catch (err) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw err;
  } finally {
    await client.query('SELECT pg_advisory_unlock(7101)').catch(() => undefined);
    client.release();
  }
}

/** Ejecuta una función dentro de una transacción. */
export async function tx<T>(fn: (c: pg.PoolClient) => Promise<T>): Promise<T> {
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
