import { register, type Command, type Ctx } from '../../core/router.js';
import { ensureCharacter, getCharacterById, getMember, getUser, insertUser, listUsers, setCharacterOwner, setUserCharacter, updateUserProfile, createRequest, setRequestMessage, hasPendingRequest, listCharactersOccupied, getActiveReservationOf, lockCharacter, resolveRequest, findPendingByMessage, audit, cancelPendingRequests, setCharacterReservation, clearCharacterReservation, type Character, type RequestRow } from '../../database/repos.js';
import { countWarnings } from '../../database/warnings.js';
import { tx } from '../../database/db.js';
import { unregisterMember } from '../../services/registry.js';
import { normalizeKey, parseCharacterName, parseNameAge, maskPhone, userPart } from '../../utils/text.js';
import { formatDate, formatRemaining } from '../../utils/time.js';
import * as F from '../../messages/design.js';
import { mention } from '../../messages/design.js';
import { config } from '../../config/index.js';
import { adminIds, getGroupMeta } from '../../core/permissions.js';

const confirmed = (ctx: Ctx) => ctx.args.at(-1)?.toLowerCase() === config.defaults.confirmWord;

const reg: Command = {
  name: 'reg',
  category: 'Registro',
  usage: '.reg <nombre.edad>',
  description: 'Registra tu cuenta en el team.',
  groupOnly: true,
  async run(ctx) {
    const parsed = parseNameAge(ctx.argText);
    if (!parsed.ok) return void (await ctx.reply(F.registroRechazado(parsed.error)));
    const { name, age } = parsed.value;

    if (await getUser(ctx.groupId, ctx.sender)) {
      return void (await ctx.reply(F.registroRechazado('Ya estás registrado. Usa .editar para cambiar tus datos.')));
    }
    try {
      await insertUser(ctx.groupId, ctx.sender, name, age);
    } catch (err) {
      if ((err as { code?: string }).code === '23505') {
        return void (await ctx.reply(F.registroRechazado('Ya existe un registro con tu número.')));
      }
      throw err;
    }
    await ctx.reply(F.registroExitoso({ name, age, phone: maskPhone(ctx.sender) }));
  },
};

const unreg: Command = {
  name: 'unreg',
  category: 'Registro',
  usage: '.unreg',
  description: 'Elimina tu registro y libera tu personaje.',
  groupOnly: true,
  async run(ctx) {
    const user = await getUser(ctx.groupId, ctx.sender);
    if (!user) return void (await ctx.reply(F.registroRechazado('No estás registrado.')));
    if (!confirmed(ctx)) {
      return void (await ctx.reply(
        `⚠️ *Confirmación requerida*\nSe eliminará tu registro, se liberará tu personaje y se cancelarán tus reservas.\nPara confirmar escribe *.unreg ${config.defaults.confirmWord}*`,
      ));
    }
    await unregisterMember(ctx.groupId, ctx.sender);
    await ctx.reply(`🗑️ Registro eliminado. Tu personaje quedó liberado.`);
  },
};

const editar: Command = {
  name: 'editar',
  category: 'Registro',
  usage: '.editar <nombre.edad>',
  description: 'Cambia tu nombre y edad (no cambia tu personaje).',
  groupOnly: true,
  async run(ctx) {
    const user = await getUser(ctx.groupId, ctx.sender);
    if (!user) return void (await ctx.reply(F.registroRechazado('Regístrate primero con .reg.')));
    const parsed = parseNameAge(ctx.argText);
    if (!parsed.ok) return void (await ctx.reply(F.registroRechazado(parsed.error)));
    await updateUserProfile(ctx.groupId, ctx.sender, parsed.value.name, parsed.value.age);
    await ctx.reply(`✧ Datos actualizados ⁙ *${parsed.value.name}* · ${parsed.value.age} años`);
  },
};

const ficha: Command = {
  name: 'ficha',
  category: 'Registro',
  usage: '.ficha',
  description: 'Muestra tu información personal.',
  groupOnly: true,
  async run(ctx) {
    const user = await getUser(ctx.groupId, ctx.sender);
    if (!user) return void (await ctx.reply(F.registroRechazado('No estás registrado. Usa .reg <nombre.edad>.')));
    const member = await getMember(ctx.groupId, ctx.sender);
    const ch = user.character_id ? await getCharacterById(user.character_id) : null;
    const warnings = await countWarnings(ctx.groupId, ctx.sender);
    const estado = member?.afk_since
      ? `AFK desde ${formatDate(member.afk_since)} (${member.afk_reason})`
      : 'Activo';
    await ctx.reply(
      F.perfilCard({
        name: user.name,
        age: user.age,
        character: ch?.name ?? 'Sin personaje',
        registered: user.registered_at,
        phone: maskPhone(ctx.sender),
        afk: estado,
        partner: 'Sin pareja',
      }) + `\n\nAdvertencias ⁙ ${warnings}/${config.defaults.warnLimit}`,
    );
  },
};

const rol: Command = {
  name: 'rol',
  category: 'Roles',
  usage: '.rol <personaje>',
  description: 'Solicita un personaje disponible.',
  groupOnly: true,
  async run(ctx) {
    const user = await getUser(ctx.groupId, ctx.sender);
    if (!user) return void (await ctx.reply(F.registroRechazado('Regístrate primero con .reg para pedir un personaje.')));
    if (user.character_id) {
      const current = await getCharacterById(user.character_id);
      return void (await ctx.reply(`Ya tienes el personaje *${current?.name ?? '?'}*. Usa .cambiarol para pedir otro.`));
    }
    const parsed = parseCharacterName(ctx.argText);
    if (!parsed.ok) return void (await ctx.reply(parsed.error));
    if (await hasPendingRequest(ctx.groupId, ctx.sender, 'rol')) {
      return void (await ctx.reply('Ya tienes una solicitud de personaje pendiente. Espera la respuesta de los admins.'));
    }

    const char = await ensureCharacter(ctx.groupId, parsed.value, normalizeKey(parsed.value));
    const check = await characterAvailability(char, ctx.sender);
    if (check) return void (await ctx.reply(check));

    const requestId = await createRequest(ctx.groupId, ctx.sender, 'rol', char.id);
    const admins = adminIds(ctx.meta!);
    const sent = await ctx.reply(
      F.solicitudPendiente({ kind: 'el personaje', character: char.name, requester: mention(ctx.sender) }),
      [...admins, ctx.sender],
    );
    if (sent?.key.id) await setRequestMessage(requestId, sent.key.id);
  },
};

/** Devuelve un mensaje si el personaje no puede asignarse al usuario, o null si está disponible. */
async function characterAvailability(char: Character, waId: string): Promise<string | null> {
  if (char.status === 'occupied' && char.owner_id !== waId) {
    const owner = await getUser(char.group_id, char.owner_id!);
    return F.personajeOcupado(char.name, owner ? owner.name : 'otro integrante');
  }
  if (char.reserved_until && new Date(char.reserved_until) > new Date() && char.reserved_by !== waId) {
    return F.personajeReservado(char.name, formatRemaining(char.reserved_until));
  }
  return null;
}

const roles: Command = {
  name: 'roles',
  category: 'Roles',
  usage: '.roles',
  description: 'Muestra los personajes ocupados.',
  groupOnly: true,
  async run(ctx) {
    const [occupied, users] = await Promise.all([listCharactersOccupied(ctx.groupId), listUsers(ctx.groupId)]);
    const byId = new Map(users.map((u) => [u.wa_id, u.name]));
    const lines = occupied.map((c) => `ㅤ୨ৎㅤ*${c.name}* ⁙ ${byId.get(c.owner_id!) ?? 'Desconocido'}`);
    await ctx.reply(
      [
        '🥢 *PERSONAJES OCUPADOS*',
        '',
        ...(lines.length ? lines : ['ㅤ(ᵕ—ᴗ—ᵕ) Ningún personaje ocupado todavía.']),
        '',
        `Total ocupados ⁙ ${occupied.length}`,
      ].join('\n'),
    );
  },
};

const mirol: Command = {
  name: 'mirol',
  category: 'Roles',
  usage: '.mirol',
  description: 'Muestra tu personaje.',
  groupOnly: true,
  async run(ctx) {
    const user = await getUser(ctx.groupId, ctx.sender);
    if (!user) return void (await ctx.reply(F.registroRechazado('Regístrate primero con .reg.')));
    if (!user.character_id) return void (await ctx.reply('No tienes personaje. Pide uno con .rol <personaje>.'));
    const ch = await getCharacterById(user.character_id);
    await ctx.reply(`🥢 Tu personaje ⁙ *${ch?.name ?? '?'}*`);
  },
};

const cambiarol: Command = {
  name: 'cambiarol',
  category: 'Roles',
  usage: '.cambiarol <personaje>',
  description: 'Solicita cambiar tu personaje (requiere aprobación).',
  groupOnly: true,
  async run(ctx) {
    const user = await getUser(ctx.groupId, ctx.sender);
    if (!user) return void (await ctx.reply(F.registroRechazado('Regístrate primero con .reg.')));
    if (!user.character_id) return void (await ctx.reply('Aún no tienes personaje. Usa .rol <personaje>.'));
    const parsed = parseCharacterName(ctx.argText);
    if (!parsed.ok) return void (await ctx.reply(parsed.error));
    const current = await getCharacterById(user.character_id);
    if (current && normalizeKey(current.name) === normalizeKey(parsed.value)) {
      return void (await ctx.reply('Ese ya es tu personaje.'));
    }
    if (await hasPendingRequest(ctx.groupId, ctx.sender, 'cambio')) {
      return void (await ctx.reply('Ya tienes un cambio de personaje pendiente.'));
    }
    const char = await ensureCharacter(ctx.groupId, parsed.value, normalizeKey(parsed.value));
    const check = await characterAvailability(char, ctx.sender);
    if (check) return void (await ctx.reply(check));

    const requestId = await createRequest(ctx.groupId, ctx.sender, 'cambio', char.id, String(user.character_id));
    const sent = await ctx.reply(
      F.solicitudPendiente({
        kind: `cambiar a *${current?.name ?? '?'}* por el personaje`,
        character: char.name,
        requester: mention(ctx.sender),
      }),
      [...adminIds(ctx.meta!), ctx.sender],
    );
    if (sent?.key.id) await setRequestMessage(requestId, sent.key.id);
  },
};

const reservar: Command = {
  name: 'reservar',
  category: 'Roles',
  usage: '.reservar <personaje>',
  description: `Reserva un personaje por ${config.defaults.reservationHours} horas.`,
  groupOnly: true,
  async run(ctx) {
    const user = await getUser(ctx.groupId, ctx.sender);
    if (!user) return void (await ctx.reply(F.registroRechazado('Regístrate primero con .reg.')));
    if (user.character_id) return void (await ctx.reply('Ya tienes un personaje asignado; no puedes reservar otro.'));
    const parsed = parseCharacterName(ctx.argText);
    if (!parsed.ok) return void (await ctx.reply(parsed.error));

    const active = await getActiveReservationOf(ctx.groupId, ctx.sender);
    if (active) {
      return void (await ctx.reply(
        `Ya tienes una reserva activa de *${active.name}* (vence en ${formatRemaining(active.reserved_until!)}).`,
      ));
    }

    const char = await ensureCharacter(ctx.groupId, parsed.value, normalizeKey(parsed.value));
    const until = new Date(Date.now() + config.defaults.reservationHours * 3_600_000);

    const result = await tx(async (c) => {
      const locked = await lockCharacter(char.id, c);
      if (locked.status === 'occupied') return { error: await characterAvailability(locked, ctx.sender) };
      if (locked.reserved_until && new Date(locked.reserved_until) > new Date()) {
        return {
          error:
            locked.reserved_by === ctx.sender
              ? `Ya tienes reservado a *${locked.name}* (vence en ${formatRemaining(locked.reserved_until)}).`
              : F.personajeReservado(locked.name, formatRemaining(locked.reserved_until)),
        };
      }
      await setCharacterReservation(locked.id, ctx.sender, until, c);
      return { error: null };
    });
    if (result.error) return void (await ctx.reply(result.error));
    await ctx.reply(F.reservaCreada({ character: char.name, remaining: formatRemaining(until) }));
  },
};

const liberar: Command = {
  name: 'liberar',
  category: 'Roles',
  usage: '.liberar',
  description: 'Libera tu propio personaje.',
  groupOnly: true,
  async run(ctx) {
    const user = await getUser(ctx.groupId, ctx.sender);
    if (!user?.character_id) return void (await ctx.reply('No tienes personaje que liberar.'));
    const ch = await getCharacterById(user.character_id);
    if (!confirmed(ctx)) {
      return void (await ctx.reply(
        `⚠️ *Confirmación requerida*\nSe liberará *${ch?.name ?? '?'}* y volverá a estar disponible.\nPara confirmar escribe *.liberar ${config.defaults.confirmWord}*`,
      ));
    }
    await tx(async (c) => {
      await setCharacterOwner(user.character_id!, null, c);
      await setUserCharacter(ctx.groupId, ctx.sender, null, c);
    });
    await ctx.reply(F.liberado({ character: ch?.name ?? '?' }));
  },
};

const resetrol: Command = {
  name: 'resetrol',
  category: 'Administración',
  usage: '.resetrol @usuario',
  description: 'Libera el personaje de otro integrante (sin borrar su registro).',
  groupOnly: true,
  adminOnly: true,
  async run(ctx) {
    const target = ctx.mentions[0];
    if (!target) return void (await ctx.reply('Menciona al integrante. Ejemplo: .resetrol @usuario'));
    const user = await getUser(ctx.groupId, target);
    if (!user) return void (await ctx.reply('Ese usuario no está registrado.'));
    if (!user.character_id) return void (await ctx.reply('Ese usuario no tiene personaje asignado.'));
    const ch = await getCharacterById(user.character_id);
    if (!confirmed(ctx)) {
      return void (await ctx.reply(
        `⚠️ Se liberará *${ch?.name ?? '?'}* de ${mention(target)}.\nPara confirmar escribe *.resetrol @${userPart(target)} ${config.defaults.confirmWord}*`,
        [target],
      ));
    }
    await tx(async (c) => {
      await setCharacterOwner(user.character_id!, null, c);
      await setUserCharacter(ctx.groupId, target, null, c);
    });
    await audit(ctx.groupId, ctx.sender, 'resetrol', target, { character: ch?.name });
    await ctx.reply(`♻️ ${mention(target)} ya no tiene personaje. *${ch?.name ?? '?'}* quedó libre.`, [target]);
  },
};

/** Resuelve una solicitud respondida (reply) por un admin. */
async function resolveFromReply(
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

const acceptrol: Command = {
  name: 'acceptrol',
  category: 'Administración',
  usage: '.acceptrol (respondiendo a la solicitud)',
  description: 'Aprueba una solicitud de personaje.',
  groupOnly: true,
  adminOnly: true,
  async run(ctx) {
    const result = await resolveFromReply(ctx, 'approved');
    if (!result) return void (await ctx.reply('Responde al mensaje de la solicitud con .acceptrol'));
    if (result.error) return void (await ctx.reply(`⚠️ ${result.error}`));
    const { req, char } = result;
    await audit(ctx.groupId, ctx.sender, 'acceptrol', req.user_id, { character: char?.name, type: req.type });
    await ctx.reply(F.solicitudAprobada({ character: char!.name, user: mention(req.user_id) }), [req.user_id]);
    await ctx.reply(F.personajeAsignado(char!.name), [req.user_id]);
  },
};

const denyrol: Command = {
  name: 'denyrol',
  category: 'Administración',
  usage: '.denyrol (respondiendo a la solicitud)',
  description: 'Rechaza una solicitud de personaje.',
  groupOnly: true,
  adminOnly: true,
  async run(ctx) {
    const result = await resolveFromReply(ctx, 'rejected');
    if (!result) return void (await ctx.reply('Responde al mensaje de la solicitud con .denyrol'));
    if (result.error) return void (await ctx.reply(`⚠️ ${result.error}`));
    const { req, char } = result;
    await audit(ctx.groupId, ctx.sender, 'denyrol', req.user_id, { character: char?.name, type: req.type });
    await ctx.reply(F.solicitudRechazada({ character: char!.name, user: mention(req.user_id) }), [req.user_id]);
  },
};

export const registroCommands: Command[] = [reg, unreg, editar, ficha, rol, roles, mirol, cambiarol, reservar, liberar, resetrol, acceptrol, denyrol];
register(...registroCommands);
