import { tx } from '../database/db.js';
import {
  cancelPendingRequests,
  clearReservationsBy,
  deleteUser,
  getUser,
  setCharacterOwner,
  getCharacterById,
  getMember,
} from '../database/repos.js';
import { pool } from '../database/db.js';

/**
 * Elimina el registro de un integrante: libera su personaje, cancela reservas y
 * solicitudes pendientes, quita AFK y deshace la pareja. No borra advertencias.
 */
export async function unregisterMember(groupId: string, waId: string): Promise<boolean> {
  return tx(async (c) => {
    const user = await getUser(groupId, waId, c);
    if (!user) return false;

    if (user.character_id) {
      const ch = await getCharacterById(user.character_id, c);
      if (ch && ch.owner_id === waId) await setCharacterOwner(ch.id, null, c);
    }
    await clearReservationsBy(groupId, waId, c);
    await cancelPendingRequests(groupId, waId, c);
    await c.query(
      'UPDATE members SET afk_reason = NULL, afk_since = NULL WHERE group_id = $1 AND wa_id = $2',
      [groupId, waId],
    );
    if (user.partner_id) {
      await c.query(
        'UPDATE users SET partner_id = NULL, partner_since = NULL, updated_at = now() WHERE group_id = $1 AND wa_id = $2',
        [groupId, user.partner_id],
      );
    }
    await deleteUser(groupId, waId, c);
    return true;
  });
}

/** Sincroniza datos cuando alguien sale del grupo: registro, personaje y actividad. */
export async function onMemberLeft(groupId: string, waId: string): Promise<boolean> {
  const hadRecord = Boolean(await getUser(groupId, waId));
  await unregisterMember(groupId, waId);
  await pool.query('DELETE FROM members WHERE group_id = $1 AND wa_id = $2', [groupId, waId]);
  return hadRecord;
}

export { getMember };
