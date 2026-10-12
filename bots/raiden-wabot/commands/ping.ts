import { registerPackCommand, type Command } from '../../../src/core/bot-packs.js';
import { conn } from '../../../src/core/connection.js';
import { memoryMode } from '../../../src/database/db.js';
import { getPlatformCounts } from '../../../src/database/store.js';
import { humanDuration } from '../../shared/text.js';
import { RAIDEN, raidenCard } from '../brand.js';

/** Estado del bot en vivo: latencia del almacén, conexión de WhatsApp y uptime. */
const ping: Command = {
  name: 'ping',
  category: 'General',
  usage: '.ping',
  description: 'Mide la latencia, muestra la versión y el estado de la conexión.',
  async run(ctx) {
    const startedAt = Date.now();
    const counts = await getPlatformCounts().catch(() => null);
    const latency = Date.now() - startedAt;

    await ctx.reply(raidenCard({
      title: 'Pong',
      emoji: '🏓',
      lines: [
        `Latencia del almacén ⁙ ${latency} ms`,
        `Conexión WhatsApp ⁙ ${conn.status}${conn.me ? ` (${conn.me})` : ''}`,
        `Encendido desde ⁙ ${humanDuration(Date.now() - conn.since.getTime())}`,
        `Proceso ⁙ ${humanDuration(process.uptime() * 1000)}`,
        `Base de datos ⁙ ${memoryMode ? 'modo memoria' : 'PostgreSQL'}`,
        counts ? `Bots ⁙ ${counts.totalBots} · cuentas ⁙ ${counts.users}` : '',
        `Versión ⁙ ${RAIDEN.version}`,
      ].filter(Boolean),
    }));
  },
};

registerPackCommand(RAIDEN.slug, ping);
