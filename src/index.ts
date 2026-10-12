import './commands/index.js';
import { knownCommandNames } from './commands/catalog.js';
import { allCommands } from './core/router.js';
import { loadCommandSettings } from './core/command-settings.js';
import { config } from './config/index.js';
import { migrate, pool } from './database/db.js';
import { purgeOldMessages, releaseExpiredReservations } from './database/repos.js';
import { startConnection } from './core/connection.js';
import { startWeb } from './web/server.js';
import { logger } from './utils/logger.js';

async function main(): Promise<void> {
  logger.info('boot', `${config.bot.name} ${config.bot.version} · ${config.bot.team}`);
  await migrate();
  await loadCommandSettings(allCommands().map((command) => command.name), knownCommandNames());
  startWeb();
  await startConnection();

  // Tareas de mantenimiento: reservas vencidas y registro de mensajes procesados.
  setInterval(() => {
    releaseExpiredReservations()
      .then((n) => n > 0 && logger.info('reservas', `Se liberaron ${n} reservas vencidas.`))
      .catch((err) => logger.error('reservas', (err as Error).message));
    purgeOldMessages().catch((err) => logger.error('mant', (err as Error).message));
  }, 60_000);

  const shutdown = async (signal: string) => {
    logger.info('boot', `Recibido ${signal}. Cerrando…`);
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
