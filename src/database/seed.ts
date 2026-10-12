import type { PlatformServer } from '../web/platform-data.js';
import { BOT_CATALOG, PLATFORM_SERVERS } from '../web/platform-data.js';

type Q = { query: (text: string, values?: unknown[]) => Promise<{ rowCount: number | null }> };

/**
 * Siembra (o actualiza) el catálogo de bots y los servidores.
 * Se puede ejecutar muchas veces: no duplica filas.
 */
export async function seedPlatform(q: Q): Promise<void> {
  for (const bot of BOT_CATALOG) {
    await q.query(
      `INSERT INTO bot_catalog (slug, name, emoji, tagline, description, category, pricing, price_coins,
                                price_usd, badge, accent, features, commands, popularity, featured, active, sort, link)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb,$13::jsonb,$14,$15,true,$16,$17)
       ON CONFLICT (slug) DO UPDATE SET
         name = EXCLUDED.name, emoji = EXCLUDED.emoji, tagline = EXCLUDED.tagline,
         description = EXCLUDED.description, category = EXCLUDED.category, pricing = EXCLUDED.pricing,
         price_coins = EXCLUDED.price_coins, price_usd = EXCLUDED.price_usd, badge = EXCLUDED.badge,
         accent = EXCLUDED.accent, features = EXCLUDED.features, commands = EXCLUDED.commands,
         popularity = EXCLUDED.popularity, featured = EXCLUDED.featured, sort = EXCLUDED.sort,
         link = EXCLUDED.link, updated_at = now()`,
      [
        bot.slug,
        bot.name,
        bot.emoji,
        bot.tagline,
        bot.description,
        bot.category,
        bot.pricing,
        bot.priceCoins,
        bot.priceUsd,
        bot.badge,
        bot.accent,
        JSON.stringify(bot.features),
        JSON.stringify(bot.commands),
        bot.popularity,
        bot.featured,
        bot.sort,
        bot.link,
      ],
    );
  }

  // Los bots que ya no están en el catálogo se desactivan (no se borran: borrarlos eliminaría
  // también las activaciones que las cuentas ya tenían en catalog_uses).
  const keep = BOT_CATALOG.map((bot) => bot.slug);
  const placeholders = keep.map((_, index) => `$${index + 1}`).join(', ');
  await q.query(`UPDATE bot_catalog SET active = false, updated_at = now() WHERE slug NOT IN (${placeholders})`, keep);

  for (const server of PLATFORM_SERVERS) {
    await q.query(
      `INSERT INTO platform_servers (id, name, provider, region, capacity, used, cpu, ram, disk, status, ip)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       ON CONFLICT (id) DO UPDATE SET
         name = EXCLUDED.name, provider = EXCLUDED.provider, region = EXCLUDED.region,
         capacity = EXCLUDED.capacity, status = EXCLUDED.status, ip = EXCLUDED.ip`,
      [
        server.id,
        server.name,
        server.provider,
        server.region,
        server.capacity,
        server.used,
        server.cpu,
        server.ram,
        server.disk,
        server.status,
        server.ip,
      ],
    );
  }
}

export type { PlatformServer };
