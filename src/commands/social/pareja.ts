import { register, type Command } from '../../core/router.js';
import {
  audit,
  createRequest,
  findLatestPendingByTarget,
  findPendingByMessage,
  getUser,
  hasPendingRequest,
  resolveRequest,
  setRequestMessage,
  updatePartner,
} from '../../database/repos.js';
import { mention, propuestaPareja, parejaConfirmada } from '../../messages/design.js';
import * as F from '../../messages/design-extra.js';

const pareja: Command = {
  name: 'pareja',
  category: 'Social',
  usage: '.pareja <@usuario>',
  description: 'Envía una propuesta de pareja.',
  groupOnly: true,
  async run(ctx) {
    const target = ctx.mentions[0] ?? null;
    if (!target) return void (await ctx.reply(F.faltaObjetivo(`.${ctx.command} @usuario`)));
    if (target === ctx.sender) return void (await ctx.reply('No puedes proponerte pareja a ti mismo. (๑•́ ₃ •̀๑)'));

    const [mine, other] = await Promise.all([getUser(ctx.groupId, ctx.sender), getUser(ctx.groupId, target)]);
    if (!mine) return void (await ctx.reply(F.noRegistrado(`.${ctx.command}`)));
    if (!other) return void (await ctx.reply('Esa persona no está registrada en el team.'));

    if (mine.partner_id) {
      const current = await getUser(ctx.groupId, mine.partner_id);
      return void (await ctx.reply(F.parejaOcupada({ user: mention(ctx.sender), partner: current?.name ?? 'alguien más' }), [ctx.sender]));
    }
    if (other.partner_id) {
      return void (await ctx.reply(F.parejaOcupada({ user: mention(target), partner: other.name }), [target]));
    }
    if (await hasPendingRequest(ctx.groupId, ctx.sender, 'pareja')) {
      return void (await ctx.reply('Ya tienes una propuesta de pareja pendiente. Espera la respuesta.'));
    }

    const requestId = await createRequest(ctx.groupId, ctx.sender, 'pareja', null, target);
    const sent = await ctx.reply(propuestaPareja({ from: mention(ctx.sender), to: mention(target) }), [ctx.sender, target]);
    if (sent?.key.id) await setRequestMessage(requestId, sent.key.id);
  },
};

register(pareja);

/** Acepta la última propuesta de pareja pendiente dirigida a ti. */
const aceptar: Command = {
  name: 'aceptar',
  category: 'Social',
  usage: '.aceptar',
  description: 'Acepta una propuesta de pareja pendiente.',
  groupOnly: true,
  async run(ctx) {
    const pending = ctx.quotedId
      ? await findPendingByMessage(ctx.groupId, ctx.quotedId)
      : await findLatestPendingByTarget(ctx.groupId, ctx.sender, 'pareja');
    if (!pending || pending.status !== 'pending' || pending.target_id !== ctx.sender) {
      return void (await ctx.reply('No tienes propuestas de pareja pendientes.'));
    }
    const [a, b] = await Promise.all([getUser(ctx.groupId, pending.user_id), getUser(ctx.groupId, ctx.sender)]);
    if (!a || !b) return void (await ctx.reply('La propuesta ya no es válida.'));
    await resolveRequest(pending.id, 'approved', ctx.sender);
    await updatePartner(ctx.groupId, a.wa_id, b.wa_id);
    await updatePartner(ctx.groupId, b.wa_id, a.wa_id);
    await audit(ctx.groupId, ctx.sender, 'pareja', a.wa_id, { with: b.wa_id });
    await ctx.reply(parejaConfirmada({ a: mention(a.wa_id), b: mention(b.wa_id) }), [a.wa_id, b.wa_id]);
  },
};

register(aceptar);
