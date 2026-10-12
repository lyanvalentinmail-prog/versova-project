import { describe, expect, it, vi } from 'vitest';

/**
 * Ejercita la ruta PostgreSQL de verdad: se aplica el esquema completo (versión 5) y se
 * siembran los catálogos sobre un emulador de PostgreSQL en memoria (pg-mem), y luego se
 * ejecutan los repositorios reales. Así se comprueba el SQL sin necesitar un servidor.
 */

vi.mock('../src/database/db.js', async () => {
  const { newDb } = await import('pg-mem');
  const mem = newDb();
  const adapter = mem.adapters.createPg();
  const pool = new adapter.Pool();
  const { SCHEMA_SQL } = await import('../src/database/schema.js');
  const { seedPlatform } = await import('../src/database/seed.js');

  return {
    memoryMode: false,
    pool,
    engine: mem,
    async migrate() {
      await pool.query(SCHEMA_SQL);
      await seedPlatform(pool);
    },
    async tx<T>(fn: (client: unknown) => Promise<T>): Promise<T> {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const result = await fn(client);
        await client.query('COMMIT');
        return result;
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    },
  };
});

const db = await import('../src/database/db.js');
const web = await import('../src/database/repos-web.js');
const platform = await import('../src/database/repos-platform.js');
const core = await import('../src/database/repos.js');
const warnings = await import('../src/database/warnings.js');

const GROUP = '120363000000000000@g.us';
const WA_A = '59899000111@s.whatsapp.net';
const WA_B = '59899000222@s.whatsapp.net';

await db.migrate();

describe('esquema PostgreSQL (v5) y repositorios', () => {
  it('aplica el esquema completo y siembra catálogo, tienda y servidores', async () => {
    const tables = await db.pool.query<{ table_name: string }>(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'",
    );
    const names = tables.rows.map((row) => row.table_name);
    for (const table of [
      'web_users', 'web_sessions', 'subbots', 'store_tokens', 'purchases',
      'bot_catalog', 'catalog_uses',
      'platform_servers', 'reports', 'subbot_groups', 'group_blocks',
      'groups', 'members', 'users', 'characters', 'requests', 'warnings', 'settings', 'audit_log',
    ]) {
      expect(names).toContain(table);
    }
    // La economía quedó eliminada por completo: sus tablas no deben existir.
    for (const table of ['coin_ledger', 'coin_items', 'mission_claims', 'group_bank']) {
      expect(names).not.toContain(table);
    }

    const catalog = await platform.listCatalogItems(db.pool);
    // VÉRSOVA + los bots abiertos de GitHub (Raiden WaBot y Yae Miku Bot).
    expect(catalog.length).toBe(3);
    expect(catalog.map((bot) => bot.slug)).toEqual(['versova', 'raiden', 'yae-miku']);
    // Todo el catálogo es gratis (0 $) y apunta a su repo en GitHub.
    for (const bot of catalog) {
      expect(bot.pricing).toBe('free');
      expect(Number(bot.price_usd)).toBe(0);
      expect(bot.price_coins).toBe(0);
      expect(bot.link).toMatch(/^https:\/\/github\.com\//);
    }

    const servers = await platform.listServers(db.pool);
    expect(servers.length).toBe(6);
    // Un servidor está lleno a propósito (para probar el rechazo al crear un bot).
    expect(servers.filter((server) => server.capacity === server.used).length).toBe(1);
  });

  it('guarda cuentas web, sesiones y tokens con un solo uso', async () => {
    const user = await web.createUser({ email: 'Esquema@Test.Dev', name: 'Esquema', passwordHash: 'hash' });
    expect(user.email).toBe('esquema@test.dev');
    expect(user.plan).toBe('free');

    const encontrado = await web.findUserByEmail('esquema@test.dev');
    expect(encontrado?.id).toBe(user.id);

    const expires = new Date(Date.now() + 86_400_000);
    await web.createSession('token-de-prueba', user.id, expires);
    const sesion = await web.getSessionUser('token-de-prueba');
    expect(sesion?.id).toBe(user.id);

    const [token] = await web.createTokens([{ code: 'VRSOV-PREM-AAAA-1111', type: 'premium', spaceGb: 2, ownerId: user.id }]);
    expect(token.status).toBe('unused');
    expect((await web.getTokenByCode('VRSOV-PREM-AAAA-1111'))?.id).toBe(token.id);

    const bot = await web.createSubBot({
      userId: user.id,
      name: 'Bot de esquema',
      tier: 'premium',
      tokenCode: null,
      phone: '59899000999',
      description: 'prueba',
      shortName: 'Esqui',
      longName: 'Bot de esquema largo',
      currency: 'V-Coin',
      ownerNumber: '59899000998',
      botLink: 'https://versova.app/bot',
      channelUrl: 'https://whatsapp.com/channel/esquema',
      prefixes: ['#'],
      instanceType: 'premium',
      serverId: 'vrsov-03',
      catalogSlug: 'versova',
    });
    expect(bot.prefixes).toEqual(['#']);
    expect(bot.instance_type).toBe('premium');

    const canjeado = await web.redeemToken('VRSOV-PREM-AAAA-1111', user.id, bot.id);
    expect(canjeado?.status).toBe('redeemed');
    expect(await web.redeemToken('VRSOV-PREM-AAAA-1111', user.id, bot.id)).toBeNull();

    const editado = await web.updateSubBotOptions(bot.id, user.id, { shortName: 'Nuevo', prefixes: ['~', '.'], botPrefix: '~' });
    expect(editado?.short_name).toBe('Nuevo');
    expect(editado?.prefixes).toEqual(['~', '.']);

    await web.recordPurchase({ userId: user.id, itemId: 'token-premium', itemName: 'Token Premium', quantity: 1, priceUsd: 1 });
    const compras = await web.listPurchases(user.id);
    expect(compras[0].item_id).toBe('token-premium');

    await web.updateUserPlan(user.id, 'premium');
    await web.addExtraSpace(user.id, 2);
    const actualizado = await web.findUserById(user.id);
    expect(actualizado?.plan).toBe('premium');
    expect(actualizado?.extra_space_gb).toBe(2);
    expect(await web.countSubBots(user.id)).toBe(1);
  });

  it('registra los usos del catálogo (todo gratis)', async () => {
    const user = await web.findUserByEmail('esquema@test.dev');
    expect(user).not.toBeNull();
    const id = user!.id;

    const uso = await platform.createCatalogUse({ userId: id, slug: 'raiden', subbotId: null, paidCoins: 0 });
    expect(uso.bot_slug).toBe('raiden');
    await platform.createCatalogUse({ userId: id, slug: 'raiden', subbotId: null, paidCoins: 0 });
    expect(await platform.countCatalogUses('raiden')).toBe(1);
    expect((await platform.listCatalogUses(id)).length).toBe(1);
  });

  it('maneja grupos y administradores del team', async () => {
    await core.ensureGroup(GROUP, 'Team de prueba');
    await core.saveGroupAdmins(GROUP, [WA_A]);
    const grupo = await core.getGroup(GROUP);
    expect(grupo?.name).toBe('Team de prueba');
    expect(grupo?.admins).toEqual([WA_A]);
  });

  it('guarda reglas, bloqueos, parejas, advertencias y ajustes', async () => {
    await core.setGroupRules(GROUP, 'Respeto ante todo.');
    expect(await core.getGroupRules(GROUP)).toBe('Respeto ante todo.');

    expect(await core.isBlocked(GROUP, WA_B)).toBe(false);
    await core.blockUser(GROUP, WA_B, 'Spam', WA_A);
    expect(await core.isBlocked(GROUP, WA_B)).toBe(true);
    await core.blockUser(GROUP, WA_B, 'Spam otra vez', WA_A);
    expect(await core.isBlocked(GROUP, WA_B)).toBe(true);
    expect(await core.unblockUser(GROUP, WA_B)).toBe(true);
    expect(await core.isBlocked(GROUP, WA_B)).toBe(false);
    expect(await core.unblockUser(GROUP, WA_B)).toBe(false);

    await core.insertUser(GROUP, WA_A, 'Ana', 22);
    const ana = await core.getUser(GROUP, WA_A);
    expect(ana?.name).toBe('Ana');

    await core.insertUser(GROUP, WA_B, 'Beto', 25);
    await core.updatePartner(GROUP, WA_A, WA_B);
    expect((await core.getUser(GROUP, WA_A))?.partner_id).toBe(WA_B);
    await core.updatePartner(GROUP, WA_A, null);
    expect((await core.getUser(GROUP, WA_A))?.partner_id).toBeNull();

    const requestId = await core.createRequest(GROUP, WA_A, 'pareja', null, WA_B);
    await core.setRequestMessage(requestId, 'MID-1');
    const pendiente = await core.findPendingByMessage(GROUP, 'MID-1');
    expect(pendiente?.id).toBe(requestId);
    expect(await core.hasPendingRequest(GROUP, WA_A, 'pareja')).toBe(true);
    expect((await core.findLatestPendingByTarget(GROUP, WA_B, 'pareja'))?.id).toBe(requestId);
    expect((await core.findLatestPendingByUser(GROUP, WA_A, 'pareja'))?.id).toBe(requestId);
    expect(await core.resolveRequest(requestId, 'approved', WA_B)).toBe(true);
    // Ya resuelta: deja de estar pendiente.
    expect(await core.hasPendingRequest(GROUP, WA_A, 'pareja')).toBe(false);
    expect(await core.findLatestPendingByUser(GROUP, WA_A, 'pareja')).toBeNull();

    expect(await warnings.addWarning(GROUP, WA_B, 'Motivo', WA_A)).toBe(1);
    expect(await warnings.countWarnings(GROUP, WA_B)).toBe(1);
    expect((await warnings.listWarnings(GROUP, WA_B)).length).toBe(1);
    expect(await warnings.removeLastWarning(GROUP, WA_B)).toBe(true);
    expect(await warnings.removeLastWarning(GROUP, WA_B)).toBe(false);

    await core.setSetting('command-settings', { commandDecoration: '.', disabled: [], hidden: [], aliases: {} });
    const ajustes = await core.getSetting<{ commandDecoration: string }>('command-settings');
    expect(ajustes?.commandDecoration).toBe('.');

    expect(await core.claimMessage('MSG-1')).toBe(true);
    expect(await core.claimMessage('MSG-1')).toBe(false);

    await core.audit(GROUP, WA_A, 'ban', WA_B, { reason: 'Spam' });
    const metricas = await core.getPlatformMetrics();
    expect(metricas.users).toBe(2);
    expect(metricas.actions).toBe(1);
    expect(metricas.warnings).toBe(0);
  });

  it('guarda grupos de cada bot, servidores y reportes del panel', async () => {
    const user = await web.findUserByEmail('esquema@test.dev');
    const bots = await web.listSubBots(user!.id);
    const bot = bots[0];

    await platform.upsertSubBotGroup(bot.id, { jid: GROUP, name: 'Team de prueba', members: 12 });
    await platform.upsertSubBotGroup(bot.id, { jid: GROUP, name: 'Team renombrado', members: 15 });
    const grupos = await platform.listSubBotGroups(bot.id);
    expect(grupos.length).toBe(1);
    expect(grupos[0].name).toBe('Team renombrado');
    expect(grupos[0].members).toBe(15);
    await platform.deleteSubBotGroup(bot.id, GROUP);
    expect((await platform.listSubBotGroups(bot.id)).length).toBe(0);

    const servidor = await platform.getServer('vrsov-01');
    expect(servidor?.region).toBe('Asunción');
    expect(await platform.getServer('no-existe')).toBeNull();

    const reporte = await platform.createReport({
      userId: user!.id, kind: 'suggestion', username: 'Esquema', whatsapp: '59899000111', text: 'Una sugerencia.',
    });
    expect(reporte.status).toBe('pending');
    expect((await platform.listReports(user!.id)).length).toBe(1);

    const totales = await platform.getPlatformCounts();
    expect(totales.users).toBe(1);
    expect(totales.totalBots).toBe(1);
  });

  it('registra espacio extra y compras gratuitas en la tienda', async () => {
    const user = await web.findUserByEmail('esquema@test.dev');
    const antes = (await web.findUserById(user!.id))!.extra_space_gb;
    await db.tx(async (client) => {
      await web.addExtraSpace(user!.id, 1, client as never);
      await web.recordPurchase(
        { userId: user!.id, itemId: 'space-1gb', itemName: '1 GB extra', quantity: 1, priceUsd: 0 },
        client as never,
      );
    });
    const actualizado = await web.findUserById(user!.id);
    expect(actualizado?.extra_space_gb).toBe(antes + 1);
    const compra = (await web.listPurchases(user!.id))[0];
    expect(Number(compra.price_usd)).toBe(0);
  });
});
