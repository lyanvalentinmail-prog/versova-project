// Se usa la capa de datos (store) para que el panel funcione también en modo memoria.
import { getSetting, setSetting } from '../database/store.js';

export const COMMAND_SETTINGS_KEY = 'command-settings';
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

let current: CommandSettings = copySettings(DEFAULT_COMMAND_SETTINGS);
let aliasLookup = new Map<string, string>();

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

export function getCommandSettings(): CommandSettings {
  return copySettings(current);
}

export function resolveCommandAlias(name: string): string {
  return aliasLookup.get(name.toLowerCase()) ?? name.toLowerCase();
}

export async function loadCommandSettings(activeCommandNames: string[], knownCommandNames: string[]): Promise<void> {
  const stored = await getSetting<unknown>(COMMAND_SETTINGS_KEY);
  if (!stored) {
    current = copySettings(DEFAULT_COMMAND_SETTINGS);
    rebuildAliasLookup();
    return;
  }

  try {
    current = normalizeCommandSettings(stored, activeCommandNames, knownCommandNames);
  } catch {
    // Un cambio futuro del catálogo no debe impedir que el bot arranque con ajustes viejos.
    current = copySettings(DEFAULT_COMMAND_SETTINGS);
  }
  rebuildAliasLookup();
}

export async function saveCommandSettings(
  input: unknown,
  activeCommandNames: string[],
  knownCommandNames: string[],
): Promise<CommandSettings> {
  const normalized = normalizeCommandSettings(input, activeCommandNames, knownCommandNames);
  await setSetting(COMMAND_SETTINGS_KEY, normalized);
  current = copySettings(normalized);
  rebuildAliasLookup();
  return getCommandSettings();
}

function rebuildAliasLookup(): void {
  aliasLookup = new Map<string, string>();
  for (const [command, aliases] of Object.entries(current.aliases)) {
    for (const alias of aliases) aliasLookup.set(alias, command);
  }
}
