import { register, type Command } from '../../core/router.js';
import { ensureCharacter, getActiveReservationOf, getUser, lockCharacter, setCharacterReservation } from '../../database/repos.js';
import { tx } from '../../database/db.js';
import { normalizeKey, parseCharacterName } from '../../utils/text.js';
import { formatRemaining } from '../../utils/time.js';
import * as F from '../../messages/design.js';
import { config } from '../../config/index.js';
import { characterAvailability } from './shared.js';

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

register(reservar);
