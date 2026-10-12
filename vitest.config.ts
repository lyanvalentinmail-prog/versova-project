import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    env: {
      DATABASE_URL: process.env.TEST_DATABASE_URL ?? 'postgres://test:test@127.0.0.1:5432/test',
      DB_SSL: 'false',
      DB_POOL_MAX: '1',
      CONSOLE_KEY: 'clave-de-prueba-larga',
    },
  },
});
