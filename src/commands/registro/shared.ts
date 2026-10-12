import type { Ctx } from '../../core/router.js';
import {
  cancelPendingRequests,
  findPendingByMessage,
  getCharacterById,
  getUser,
  lockCharacter,
  resolveRequest,
  setCharacterOwner,
  setUserCharacter,
  type Character,
  type RequestRow,
} from '../../database/repos.js';
import { tx } from '../../database/db.js';
import { config } from '../../config/index.js';
import { formatRemaining } from '../../utils/time.js';
import * as F from '../../messages/design.js';

export const confirmed = (ctx: Ctx) => ctx.args.at(-1)?.toLowerCase() === config.defaults.confirmWord;

/** Devuelve un mensaje si el personaje no puede asignarse al usuario, o null si está disponible. */
export async function characterAvailability(char: Character, waId: string): Promise<string | null> {
  if (char.status === 'occupied' && char.owner_id !== waId) {
    const owner = await getUser(char.group_id, char.owner_id!);
    return F.personajeOcupado(char.name, owner ? owner.name : 'otro integrante');
  }
  if (char.reserved_until && new Date(char.reserved_until) > new Date() && char.reserved_by !== waId) {
    return F.personajeReservado(char.name, formatRemaining(char.reserved_until));
  }
  return null;
}

/** Resuelve una solicitud respondida (reply) por un admin. */
export async function resolveFromReply(
  ctx: Ctx,
  status: 'approved' | 'rejected',
): Promise<{ req: RequestRow; char: Character | null; error?: string } | null> {
  if (!ctx.quotedId) return null;
  return tx(async (c) => {
    const req = await findPendingByMessage(ctx.groupId, ctx.quotedId!, c);
    if (!req) return { req: null as unknown as RequestRow, char: null, error: 'No encontré una solicitud pendiente en ese mensaje.' };
    const char = req.character_id ? await lockCharacter(req.character_id, c) : null;
    if (!char) {
      await resolveRequest(req.id, 'cancelled', ctx.sender, c);
      return { req, char: null, error: 'La solicitud ya no es válida.' };
    }
    if (status === 'rejected') {
      await resolveRequest(req.id, 'rejected', ctx.sender, c);
      return { req, char };
    }
    const requester = await getUser(ctx.groupId, req.user_id, c);
    if (!requester) {
      await resolveRequest(req.id, 'cancelled', ctx.sender, c);
      return { req, char, error: 'El solicitante ya no está registrado.' };
    }
    const reservedByOther = char.reserved_until && new Date(char.reserved_until) > new Date() && char.reserved_by !== req.user_id;
    if (char.status === 'occupied' || reservedByOther) {
      await resolveRequest(req.id, 'cancelled', ctx.sender, c);
      return { req, char, error: 'El personaje ya fue ocupado o reservado por alguien más.' };
    }
    if (req.type === 'cambio' && req.target_id) {
      const old = await getCharacterById(Number(req.target_id), c);
      if (old && old.owner_id === req.user_id) await setCharacterOwner(old.id, null, c);
    }
    if (req.type === 'rol' && requester.character_id) {
      await resolveRequest(req.id, 'cancelled', ctx.sender, c);
      return { req, char, error: 'El solicitante ya tiene personaje.' };
    }
    await setCharacterOwner(char.id, req.user_id, c);
    await setUserCharacter(ctx.groupId, req.user_id, char.id, c);
    await resolveRequest(req.id, 'approved', ctx.sender, c);
    await cancelPendingRequests(ctx.groupId, req.user_id, c);
    return { req, char };
  });
}
