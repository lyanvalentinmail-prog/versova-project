import './commands/index.js';
import { loadActiveBotFromStore, loadAllCommandSettings } from './bots/index.js';
import { config } from './config/index.js';
import { migrate, memoryMode, pool } from './database/db.js';
import { purgeOldMessages, releaseExpiredReservations } from './database/repos.js';
import { purgeExpiredSessions } from './database/store.js';
import { startConnection } from './core/connection.js';
import { startWeb } from './web/server.js';
import { logger } from './utils/logger.js';

async function main(): Promise<void> {
  logger.info('boot', `${config.bot.name} ${config.bot.version} · ${config.bot.team}`);
  await migrate();
  // Ajustes por bot (cada pack del catálogo guarda los suyos) y bot activo.
  await loadAllCommandSettings();
  const activeBot = await loadActiveBotFromStore();
  logger.info('boot', `Bot activo: ${activeBot}.`);
  const server = startWeb();
  if (memoryMode) {
    logger.warn('boot', 'Modo memoria: la conexión de WhatsApp no se inicia (define DATABASE_URL para usarla).');
  } else {
    await startConnection();
  }

  // Tareas de mantenimiento: reservas vencidas, registro de mensajes y sesiones web vencidas.
  // En modo memoria no hay tablas que limpiar.
  const maintenance = memoryMode ? null : setInterval(() => {
    releaseExpiredReservations()
      .then((n) => n > 0 && logger.info('reservas', `Se liberaron ${n} reservas vencidas.`))
      .catch((err) => logger.error('reservas', (err as Error).message));
    purgeOldMessages().catch((err) => logger.error('mant', (err as Error).message));
    purgeExpiredSessions().catch((err) => logger.error('sesiones', (err as Error).message));
  }, 60_000);
  if (maintenance) maintenance.unref();

  const shutdown = async (signal: string) => {
    logger.info('boot', `Recibido ${signal}. Cerrando…`);
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await pool.end().catch(() => undefined);
    process.exit(0);
  };
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

// Un error inesperado no debe detener el bot: se registra y se sigue.
process.on('unhandledRejection', (reason) => logger.error('proceso', `Promesa no controlada: ${String(reason)}`));
process.on('uncaughtException', (err) => logger.error('proceso', `Excepción no controlada: ${err.stack ?? err.message}`));

main().catch((err) => {
  logger.error('boot', `No se pudo iniciar: ${(err as Error).message}`);
  process.exit(1);
});
