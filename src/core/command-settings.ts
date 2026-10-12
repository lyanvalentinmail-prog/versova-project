// Se usa la capa de datos (store) para que el panel funcione también en modo memoria.
import { getSetting, setSetting } from '../database/store.js';
import { DEFAULT_PACK_SLUG } from './bot-packs.js';

export const COMMAND_SETTINGS_KEY = 'command-settings';

/** Cada bot del catálogo guarda sus propios ajustes (activar/ocultar/alias). */
export function commandSettingsKey(pack: string = DEFAULT_PACK_SLUG): string {
  return pack === DEFAULT_PACK_SLUG ? COMMAND_SETTINGS_KEY : `${COMMAND_SETTINGS_KEY}:${pack}`;
}
export const DEFAULT_COMMAND_DECORATION = 'ㅤ୨ৎㅤ.';

export interface CommandSettings {
  /** Decoración visual del menú; el prefijo real que se escribe en WhatsApp sigue siendo ".". */
  commandDecoration: string;
  disabled: string[];
  hidden: string[];
  aliases: Record<string, string[]>;
}

export const DEFAULT_COMMAND_SETTINGS: CommandSettings = {
  commandDecoration: DEFAULT_COMMAND_DECORATION,
  disabled: [],
  hidden: [],
  aliases: {},
};

const current = new Map<string, CommandSettings>([[DEFAULT_PACK_SLUG, copySettings(DEFAULT_COMMAND_SETTINGS)]]);
const aliasLookups = new Map<string, Map<string, string>>();

function copySettings(settings: CommandSettings): CommandSettings {
  return {
    commandDecoration: settings.commandDecoration,
    disabled: [...settings.disabled],
    hidden: [...settings.hidden],
    aliases: Object.fromEntries(Object.entries(settings.aliases).map(([name, aliases]) => [name, [...aliases]])),
  };
}

/** Normaliza y valida la configuración editable desde la consola. */
export function normalizeCommandSettings(
  input: unknown,
  activeCommandNames: string[],
  knownCommandNames: string[],
): CommandSettings {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('La configuración de comandos no es válida.');
  }

  const value = input as Record<string, unknown>;
  const activeNames = new Set(activeCommandNames);
  const knownNames = new Set(knownCommandNames);
  const commandDecoration = value.commandDecoration;
  if (typeof commandDecoration !== 'string' || commandDecoration.length > 40 || /[\r\n]/.test(commandDecoration)) {
    throw new Error('El texto antes del comando debe tener hasta 40 caracteres y no puede contener saltos de línea.');
  }

  const disabled = normalizeNameList(value.disabled, activeNames, 'comandos desactivados');
  const hidden = normalizeNameList(value.hidden, knownNames, 'comandos ocultos');
  const aliases = normalizeAliases(value.aliases, activeNames, activeCommandNames);

  return { commandDecoration, disabled, hidden, aliases };
}

function normalizeNameList(value: unknown, allowed: Set<string>, label: string): string[] {
  if (!Array.isArray(value) || value.length > 200 || value.some((item) => typeof item !== 'string')) {
    throw new Error(`La lista de ${label} no es válida.`);
  }
  const normalized = [...new Set(value.map((item) => (item as string).toLowerCase()))];
  if (normalized.some((name) => !allowed.has(name))) {
    throw new Error(`La lista de ${label} contiene un comando desconocido.`);
  }
  return normalized;
}

function normalizeAliases(value: unknown, activeNames: Set<string>, activeCommandNames: string[]): Record<string, string[]> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('La lista de alias no es válida.');
  }

  const reservedNames = new Set(activeCommandNames.map((name) => name.toLowerCase()));
  const seenAliases = new Set<string>();
  const normalized: Record<string, string[]> = {};

  for (const [rawCommand, rawAliases] of Object.entries(value as Record<string, unknown>)) {
    const command = rawCommand.toLowerCase();
    if (!activeNames.has(command)) throw new Error(`No se pueden crear alias para el comando "${rawCommand}".`);
    if (!Array.isArray(rawAliases) || rawAliases.length > 8 || rawAliases.some((alias) => typeof alias !== 'string')) {
      throw new Error(`Los alias de .${command} no son válidos (máximo 8).`);
    }

    const aliases = [...new Set(rawAliases.map((alias) => (alias as string).trim().toLowerCase()))];
    for (const alias of aliases) {
      if (!/^[a-z0-9_-]{1,24}$/.test(alias)) {
        throw new Error(`El alias "${alias}" solo puede contener letras, números, guion y guion bajo (1–24 caracteres).`);
      }
      if (reservedNames.has(alias)) throw new Error(`"${alias}" ya es el nombre de un comando.`);
      if (seenAliases.has(alias)) throw new Error(`El alias "${alias}" ya está asignado a otro comando.`);
      seenAliases.add(alias);
    }
    if (aliases.length) normalized[command] = aliases;
  }

  return normalized;
}

export function getCommandSettings(pack: string = DEFAULT_PACK_SLUG): CommandSettings {
  return copySettings(current.get(pack) ?? DEFAULT_COMMAND_SETTINGS);
}

export function resolveCommandAlias(pack: string, name: string): string {
  return aliasLookups.get(pack)?.get(name.toLowerCase()) ?? name.toLowerCase();
}

export async function loadCommandSettings(
  activeCommandNames: string[],
  knownCommandNames: string[],
  pack: string = DEFAULT_PACK_SLUG,
): Promise<void> {
  const stored = await getSetting<unknown>(commandSettingsKey(pack));
  if (!stored) {
    current.set(pack, copySettings(DEFAULT_COMMAND_SETTINGS));
    rebuildAliasLookup(pack);
    return;
  }

  try {
    current.set(pack, normalizeCommandSettings(stored, activeCommandNames, knownCommandNames));
  } catch {
    // Un cambio futuro del catálogo no debe impedir que el bot arranque con ajustes viejos.
    current.set(pack, copySettings(DEFAULT_COMMAND_SETTINGS));
  }
  rebuildAliasLookup(pack);
}

export async function saveCommandSettings(
  input: unknown,
  activeCommandNames: string[],
  knownCommandNames: string[],
  pack: string = DEFAULT_PACK_SLUG,
): Promise<CommandSettings> {
  const normalized = normalizeCommandSettings(input, activeCommandNames, knownCommandNames);
  await setSetting(commandSettingsKey(pack), normalized);
  current.set(pack, copySettings(normalized));
  rebuildAliasLookup(pack);
  return getCommandSettings(pack);
}

function rebuildAliasLookup(pack: string): void {
  const lookup = new Map<string, string>();
  for (const [command, aliases] of Object.entries(getCommandSettings(pack).aliases)) {
    for (const alias of aliases) lookup.set(alias, command);
  }
  aliasLookups.set(pack, lookup);
}
