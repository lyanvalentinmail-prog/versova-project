import { register, type Command } from '../../core/router.js';
import { audit } from '../../database/repos.js';
import { mention } from '../../messages/design.js';
import { digitsOnly as onlyDigits } from '../../utils/text.js';
import * as F from '../../messages/design-extra.js';

const add: Command = {
  name: 'add',
  category: 'Administración',
  usage: '.add <número>',
  description: 'Añade un integrante al grupo.',
  groupOnly: true,
  adminOnly: true,
  needsBotAdmin: true,
  async run(ctx) {
    const raw = ctx.args.find((arg) => /\d{7,}/.test(arg)) ?? ctx.mentions[0] ?? '';
    const digits = onlyDigits(raw);
    if (digits.length < 8) return void (await ctx.reply(F.faltaObjetivo('.add 59899999999')));
    const jid = `${digits}@s.whatsapp.net`;

    try {
      const result = await ctx.sock.groupParticipantsUpdate(ctx.chat, [jid], 'add');
      const status = result?.[0]?.status ?? '200';
      const failed = ['403', '408', '409', '500'].includes(String(status));
      await audit(ctx.groupId, ctx.sender, 'add', jid, { status });
      if (failed) {
        await ctx.reply(
          F.noPuedoHacerlo(
            status === '403'
              ? 'Ese número tiene la privacidad cerrada: pídele que escriba al grupo o que comparta enlace.'
              : `WhatsApp respondió con el estado ${status}.`,
          ),
        );
        return;
      }
      await ctx.reply(F.accionAdd({ user: mention(jid), by: mention(ctx.sender) }), [jid, ctx.sender]);
    } catch (err) {
      await ctx.reply(F.noPuedoHacerlo(`No pude añadir ese número: ${(err as Error).message}`));
    }
  },
};

register(add);
