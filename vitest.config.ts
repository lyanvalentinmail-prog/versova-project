import { defineConfig } from 'vitest/config';

/**
 * Las pruebas que tocan PostgreSQL de verdad (db, web-auth) se activan con
 * TEST_DATABASE_URL. El resto corre en MODO MEMORIA para que la suite funcione
 * sin base de datos, que es como se prueba la plataforma por defecto.
 */
export default defineConfig({
  test: {
    env: {
      DATABASE_URL: process.env.TEST_DATABASE_URL ?? '',
      DB_SSL: 'false',
      DB_POOL_MAX: '1',
    },
  },
});
