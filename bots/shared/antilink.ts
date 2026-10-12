/**
 * Guardias de moderación compartidas: antilink y mute.
 *
 * Las usan Raiden WaBot y Yae Miku Bot (cada uno con su mensaje). A diferencia de
 * un comando, una guardia corre con **cada mensaje** del grupo, así que aquí es
 * donde se borran los enlaces y se expulsa a quien insiste.
 */
import type { BotGuard, GuardCtx } from '../../src/core/bot-packs.js';
import { registerGuard } from '../../src/core/guards.js';
import { logger } from '../../src/utils/logger.js';
import { maskPhone, userPart } from '../../src/utils/text.js';
import { hasLink, firstLink, detectPlatform } from './links.js';
import { bumpNumber, readGroupSetting, readNumber, writeGroupSetting } from './store.js';

export type AntilinkAction = 'delete' | 'warn' | 'kick';

export interface AntilinkConfig {
  enabled: boolean;
  action: AntilinkAction;
}

export const DEFAULT_ANTILINK: AntilinkConfig = { enabled: false, action: 'warn' };

/** Avisos antes de expulsar cuando la acción es `warn`. */
export const ANTILINK_WARN_LIMIT = 3;

export const ANTILINK_KEY = 'antilink';
export const MUTE_KEY = 'mute';

export async function getAntilink(groupId: string): Promise<AntilinkConfig> {
  const stored = await readGroupSetting<Partial<AntilinkConfig>>(groupId, ANTILINK_KEY);
  if (!stored) return { ...DEFAULT_ANTILINK };
  const action: AntilinkAction =
    stored.action === 'kick' || stored.action === 'delete' || stored.action === 'warn' ? stored.action : 'warn';
  return { enabled: Boolean(stored.enabled), action };
}

export async function setAntilink(groupId: string, config: AntilinkConfig): Promise<AntilinkConfig> {
  await writeGroupSetting(groupId, ANTILINK_KEY, config);
  return config;
}

export async function isMuted(groupId: string): Promise<boolean> {
  return Boolean(await readGroupSetting<boolean>(groupId, MUTE_KEY));
}

export async function setMuted(groupId: string, muted: boolean): Promise<void> {
  await writeGroupSetting(groupId, MUTE_KEY, muted);
}

function antilinkMessage(ctx: GuardCtx, action: AntilinkAction, warns: number, brand: string): string {
  const who = `@${userPart(ctx.sender)}`;
  if (action === 'kick') return `🚫 ${who} envió un enlace y fue expulsado del grupo.\n${brand}`;
  if (action === 'delete') return `🧹 Enlace eliminado. ${who}, los enlaces no están permitidos aquí.\n${brand}`;
  return `⚠️ ${who}, los enlaces no están permitidos (aviso ${warns}/${ANTILINK_WARN_LIMIT}).\n${brand}`;
}

export interface AntilinkOptions {
  /** Firma al pie de los avisos (por ejemplo `⚡ ʀᴀɪᴅᴇɴ ʙᴏᴛ`). */
  brand: string;
  /** Nombre de la guardia (permite varias por pack). */
  name: string;
  /** También borra los enlaces de los administradores. Por defecto no. */
  moderateAdmins?: boolean;
}

/**
 * Registra la guardia de antilink en un pack. La configuración vive en los ajustes
 * del grupo, así que se cambia con `.antilink on|delete|warn|kick`.
 */
export function registerAntilinkGuard(pack: string, options: AntilinkOptions): void {
  const guard: BotGuard = {
    name: options.name,
    description: 'Borra los enlaces prohibidos y aplica avisos o expulsiones según la configuración del grupo.',
    async run(ctx: GuardCtx) {
      if (!ctx.isGroup || ctx.isOwner) return;
      if (ctx.isAdmin && !options.moderateAdmins) return;
      const config = await getAntilink(ctx.groupId ?? ctx.chat);
      if (!config.enabled || !hasLink(ctx.text)) return;

      const groupId = ctx.groupId ?? ctx.chat;
      try {
        await ctx.sock.sendMessage(ctx.chat, { delete: ctx.msg.key });
      } catch (err) {
        logger.warn('antilink', `No se pudo borrar el enlace: ${(err as Error).message}`);
      }

      let warns = await bumpNumber(groupId, ctx.sender, 'antilink_warns', 1);
      let action = config.action;

      if (action === 'kick' || (action === 'warn' && warns >= ANTILINK_WARN_LIMIT)) {
        if (ctx.botIsAdmin) {
          try {
            await ctx.sock.groupParticipantsUpdate(ctx.chat, [ctx.sender], 'remove');
            action = 'kick';
          } catch (err) {
            logger.warn('antilink', `No se pudo expulsar: ${(err as Error).message}`);
            action = 'delete';
          }
        } else {
          action = 'delete';
        }
        warns = await readNumber(groupId, ctx.sender, 'antilink_warns');
      }

      const link = firstLink(ctx.text) ?? '';
      const platform = link ? detectPlatform(link).name : 'el enlace';
      logger.info(
        'antilink',
        `${maskPhone(userPart(ctx.sender))} · ${platform} · acción ${action} (${warns} avisos)`,
      );
      await ctx.reply(antilinkMessage(ctx, action, warns, options.brand), [ctx.sender]);
    },
  };
  registerGuard(pack, guard);
}

export interface MuteOptions {
  brand: string;
  name: string;
}

/**
 * Registra la guardia de mute: mientras el grupo está silenciado solo escriben los
 * administradores (lo activa `.mute` y lo apaga `.unmute`).
 */
export function registerMuteGuard(pack: string, options: MuteOptions): void {
  const guard: BotGuard = {
    name: options.name,
    description: 'Mientras el grupo está silenciado solo pueden hablar los administradores.',
    async run(ctx: GuardCtx) {
      if (!ctx.isGroup || ctx.isAdmin || ctx.isOwner) return;
      const groupId = ctx.groupId ?? ctx.chat;
      if (!(await isMuted(groupId))) return;

      try {
        await ctx.sock.sendMessage(ctx.chat, { delete: ctx.msg.key });
      } catch (err) {
        logger.warn('mute', `No se pudo borrar el mensaje: ${(err as Error).message}`);
      }
    },
  };
  registerGuard(pack, guard);
}

export interface ActivityOptions {
  name: string;
  /** Clave del contador de mensajes (`.top`). */
  key: string;
}

/** Cuenta los mensajes de cada integrante para el ranking `.top`. */
export function registerActivityGuard(pack: string, options: ActivityOptions): void {
  const guard: BotGuard = {
    name: options.name,
    description: 'Cuenta los mensajes del grupo para el ranking de actividad.',
    async run(ctx: GuardCtx) {
      if (!ctx.isGroup || ctx.isOwner) return;
      await bumpNumber(ctx.groupId ?? ctx.chat, ctx.sender, options.key, 1);
    },
  };
  registerGuard(pack, guard);
}
