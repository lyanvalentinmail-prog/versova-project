import type { GroupMetadata, WAMessage, WASocket } from '@whiskeysockets/baileys';

/**
 * Motor multi-bot.
 *
 * La plataforma ejecuta un bot de WhatsApp por conexión, pero el catálogo tiene
 * varios bots (VÉRSOVA, Raiden WaBot y Yae Miku Bot). Cada bot del catálogo se
 * implementa como un «pack»: un paquete con su ficha (nombre, emoji, enlace al
 * repo) y sus comandos.
 *
 * Los comandos del núcleo (registro, personajes, administración…) forman el pack
 * base `versova` y los demás packs los heredan: si un pack define un comando con
 * el mismo nombre, su versión gana (por ejemplo, cada bot tiene su propio `.menu`).
 * El código de cada bot vive en la carpeta `bots/` del repositorio.
 */

/** Pack por defecto: el bot base de la plataforma. */
export const DEFAULT_PACK_SLUG = 'versova';

export interface Ctx {
  sock: WASocket;
  msg: WAMessage;
  chat: string;
  isGroup: boolean;
  groupId: string;
  /** Identificador normalizado de quien envía (clave en la base). */
  sender: string;
  senderName: string;
  command: string;
  /** Pack del bot que está resolviendo el mensaje (versova, raiden-wabot…). */
  pack: string;
  args: string[];
  argText: string;
  mentions: string[];
  quotedId: string | null;
  meta: GroupMetadata | null;
  isAdmin: boolean;
  isOwner: boolean;
  botIsAdmin: boolean;
  /** Responde citando el mensaje original. Devuelve el mensaje enviado. */
  reply: (text: string, mentions?: string[]) => Promise<WAMessage | undefined>;
}

export type CommandCategory =
  | 'Registro'
  | 'Roles'
  | 'General'
  | 'Equipo'
  | 'Social'
  | 'Administración'
  | 'Descargas'
  | 'Stickers'
  | 'IA'
  | 'Imágenes'
  | 'Moderación'
  | 'Reacciones'
  | 'Economía';

export interface Command {
  name: string;
  category: CommandCategory;
  usage: string;
  description: string;
  groupOnly?: boolean;
  adminOnly?: boolean;
  ownerOnly?: boolean;
  needsBotAdmin?: boolean;
  /** Marca el comando como parte del pack (lo rellena el registro). */
  pack?: string;
  run: (ctx: Ctx) => Promise<void>;
}

/** Contexto que reciben las guardias: se ejecutan en cada mensaje, no solo en comandos. */
export interface GuardCtx {
  sock: WASocket;
  msg: WAMessage;
  chat: string;
  isGroup: boolean;
  /** Igual que `chat` en grupos; cadena vacía en privado. */
  groupId: string;
  sender: string;
  senderName: string;
  text: string;
  mentions: string[];
  isAdmin: boolean;
  botIsAdmin: boolean;
  isOwner: boolean;
  pack: string;
  reply: (text: string, mentions?: string[]) => Promise<WAMessage | undefined>;
}

export interface BotGuard {
  name: string;
  description: string;
  run: (ctx: GuardCtx) => Promise<void>;
}

export interface BotPack {
  /** Identificador estable (coincide con el `slug` del catálogo y con la carpeta en `bots/`). */
  slug: string;
  /** Nombres alternativos aceptados por la API (`create` del asistente, panel…). */
  aliases: string[];
  name: string;
  emoji: string;
  tagline: string;
  description: string;
  category: string;
  accent: string;
  /** Repositorio en GitHub con el código de la instancia. */
  link: string;
  /** Prefijo sugerido para las instancias de este bot. */
  prefix: string;
  /** Prefijo de carpeta en el repositorio (`bots/<folder>`). */
  folder: string;
  features: string[];
  /** Comandos propios (los del núcleo se heredan y no se listan aquí). */
  highlights: string[];
}

interface PackEntry {
  pack: BotPack;
  commands: Map<string, Command>;
}

const coreCommands = new Map<string, Command>();
const packs = new Map<string, PackEntry>();
const aliasIndex = new Map<string, string>();

/* --------------------------------- registro -------------------------------- */

function assertNoDuplicates(target: Map<string, Command>, commands: Command[], label: string): void {
  for (const command of commands) {
    if (target.has(command.name)) throw new Error(`Comando duplicado en ${label}: ${command.name}`);
  }
}

/** Comandos del núcleo: los hereda cualquier pack (a menos que el pack los reemplace). */
export function registerCoreCommand(...commands: Command[]): void {
  assertNoDuplicates(coreCommands, commands, DEFAULT_PACK_SLUG);
  for (const command of commands) coreCommands.set(command.name, command);
}

/** Registra la ficha de un bot del catálogo. */
export function registerPack(pack: BotPack): void {
  const existing = packs.get(pack.slug);
  packs.set(pack.slug, { pack, commands: existing?.commands ?? new Map() });
  aliasIndex.set(pack.slug, pack.slug);
  for (const alias of pack.aliases) aliasIndex.set(alias.toLowerCase(), pack.slug);
}

/** Registra comandos propios de un pack: reemplazan a los del núcleo con el mismo nombre. */
export function registerPackCommand(slug: string, ...commands: Command[]): void {
  const entry = packs.get(slug);
  if (!entry) throw new Error(`El bot «${slug}» no está registrado (llama antes a registerPack).`);
  assertNoDuplicates(entry.commands, commands, slug);
  for (const command of commands) entry.commands.set(command.name, { ...command, pack: slug });
}

/* --------------------------------- consulta -------------------------------- */

/** Normaliza un slug o alias al slug canónico del pack (null si no existe). */
export function resolvePackSlug(slug: string | null | undefined): string | null {
  if (!slug) return null;
  return aliasIndex.get(slug.trim().toLowerCase()) ?? null;
}

export function getPack(slug: string | null | undefined): BotPack | null {
  const resolved = resolvePackSlug(slug);
  return resolved ? (packs.get(resolved)?.pack ?? null) : null;
}

export function allPacks(): BotPack[] {
  return [...packs.values()].map((entry) => entry.pack);
}

/**
 * Comandos propios del pack. El pack base `versova` es dueño de los comandos del
 * núcleo (los demás los heredan), así que para él cuentan como propios.
 */
export function packCommands(slug: string): Command[] {
  const resolved = resolvePackSlug(slug);
  if (!resolved) return [];
  const own = [...(packs.get(resolved)?.commands.values() ?? [])];
  if (resolved !== DEFAULT_PACK_SLUG) return own;
  const merged = new Map(coreCommands);
  for (const command of own) merged.set(command.name, command);
  return [...merged.values()];
}

/** Comandos efectivos del pack: núcleo + propios (los propios ganan). */
export function commandsForPack(slug: string = DEFAULT_PACK_SLUG): Command[] {
  const resolved = resolvePackSlug(slug) ?? DEFAULT_PACK_SLUG;
  const merged = new Map(coreCommands);
  for (const [name, command] of packs.get(resolved)?.commands ?? []) merged.set(name, command);
  return [...merged.values()];
}

export function commandForPack(slug: string, name: string): Command | undefined {
  const resolved = resolvePackSlug(slug) ?? DEFAULT_PACK_SLUG;
  const lower = name.toLowerCase();
  return packs.get(resolved)?.commands.get(lower) ?? coreCommands.get(lower);
}

/** Todos los nombres de comando conocidos por la plataforma (cualquier pack). */
export function knownCommandNamesAcrossPacks(): string[] {
  const names = new Set<string>([...coreCommands.keys()]);
  for (const entry of packs.values()) for (const name of entry.commands.keys()) names.add(name);
  return [...names];
}

/** ¿Existe ese comando en algún pack o en el núcleo? */
export function commandExists(name: string): boolean {
  const lower = name.toLowerCase();
  if (coreCommands.has(lower)) return true;
  for (const entry of packs.values()) if (entry.commands.has(lower)) return true;
  return false;
}
