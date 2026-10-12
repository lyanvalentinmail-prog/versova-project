import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { migrate, pool, tx } from '../src/database/db.js';
import * as repos from '../src/database/repos.js';
import { unregisterMember, onMemberLeft } from '../src/services/registry.js';
import { addWarning, countWarnings } from '../src/database/warnings.js';

const enabled = Boolean(process.env.TEST_DATABASE_URL);
const G = 'group-test@g.us';
const A = '59800000001@s.whatsapp.net';
const B = '59800000002@s.whatsapp.net';

describe.skipIf(!enabled)('base de datos (integración)', () => {
  beforeAll(async () => {
    await migrate();
    await pool.query('TRUNCATE groups, members, users, characters, requests, warnings, audit_log, processed_messages, settings CASCADE');
    await repos.ensureGroup(G, 'Team de prueba');
    await repos.insertUser(G, A, 'Moon', 17);
    await repos.insertUser(G, B, 'Luna', 18);
  });
  afterAll(async () => {
    await pool.end();
  });

  it('datos de grupos separados', async () => {
    await repos.ensureGroup('otro@g.us', 'Otro');
    expect(await repos.getUser('otro@g.us', A)).toBeNull();
  });

  it('no permite registros duplicados', async () => {
    await expect(repos.insertUser(G, A, 'Moon2', 20)).rejects.toMatchObject({ code: '23505' });
  });

  it('las solicitudes solo se resuelven una vez', async () => {
    const id = await repos.createRequest(G, A, 'rol', null);
    expect(await repos.resolveRequest(id, 'approved', 'admin')).toBe(true);
    expect(await repos.resolveRequest(id, 'approved', 'admin')).toBe(false);
  });

  it('dedupe de mensajes', async () => {
    expect(await repos.claimMessage('MSG-1')).toBe(true);
    expect(await repos.claimMessage('MSG-1')).toBe(false);
  });

  it('libera reservas vencidas', async () => {
    const ch = await repos.ensureCharacter(G, 'Nyx', 'nyx');
    await pool.query("UPDATE characters SET reserved_by=$2, reserved_until = now() - interval '1 minute' WHERE id=$1", [ch.id, A]);
    expect(await repos.releaseExpiredReservations()).toBeGreaterThanOrEqual(1);
    const row = await repos.getCharacterById(ch.id);
    expect(row?.reserved_by).toBeNull();
  });

  it('al salir del grupo se libera personaje, se borra el registro y la actividad', async () => {
    await repos.touchMember(G, B, 'Luna');
    await addWarning(G, B, 'Spam', 'admin');
    expect(await onMemberLeft(G, B)).toBe(true);
    expect(await repos.getUser(G, B)).toBeNull();
    expect(await repos.getMember(G, B)).toBeNull();
    const ch = await repos.ensureCharacter(G, 'Felix', 'felix');
    expect(ch.status).toBe('free');
    // las advertencias se conservan
    expect(await countWarnings(G, B)).toBe(1);
  });

  it('desregistro libera personaje y reservas', async () => {
    const ch = await repos.ensureCharacter(G, 'Kai', 'kai');
    await repos.insertUser(G, B, 'Luna', 18);
    await tx(async (c) => {
      await repos.setCharacterOwner(ch.id, B, c);
      await repos.setUserCharacter(G, B, ch.id, c);
    });
    expect(await unregisterMember(G, B)).toBe(true);
    const row = await repos.getCharacterById(ch.id);
    expect(row?.status).toBe('free');
    expect(row?.owner_id).toBeNull();
  });
});
