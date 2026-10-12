import { allCommands } from '../core/router.js';
import {
  DEFAULT_COMMAND_DECORATION,
  getCommandSettings,
  type CommandSettings,
} from '../core/command-settings.js';

export const DEFAULT_BANNER_TEXT = [
  'ㅤㅤㅤㅤۖㅤㅤㅤㅤㅤۖ',
  'ㅤㅤ࿚ׄ࿙ֹ࿚᮫᜔۬፟֟࿙ֹ࿚ׄ࿙',
  'ㅤㅤㅤㅤㅤ𓆩ㅤ禊ㅤ𓆪',
  'ㅤㅤㅤ𝑽 𝑬́ 𝑹 𝑺 𝑶 𝑽 𝑨',
  'ㅤㅤㅤㅤ𝐁𝗈𝗍 𝗌𝗒𝗌𝗍𝖾𝗆',
].join('\n\n');

export interface MenuCommandDefinition {
  name: string;
  args: string;
  category: string;
  description: string;
}

/** Catálogo del menú solicitado. Los comandos aún sin módulo se muestran como pendientes en la web. */
export const MENU_COMMANDS: MenuCommandDefinition[] = [
  { name: 'reg', args: '<nombre.edad>', category: 'Registro', description: 'Registra tu cuenta en el team.' },
  { name: 'unreg', args: '', category: 'Registro', description: 'Elimina tu registro y libera tu personaje.' },
  { name: 'rol', args: '<personaje>', category: 'Registro', description: 'Solicita un personaje disponible.' },
  { name: 'roles', args: '', category: 'Registro', description: 'Muestra los personajes ocupados.' },
  { name: 'ficha', args: '', category: 'Registro', description: 'Muestra tu información personal.' },
  { name: 'editar', args: '<nombre.edad>', category: 'Registro', description: 'Cambia tu nombre y edad.' },
  { name: 'mirol', args: '', category: 'Registro', description: 'Muestra tu personaje.' },
  { name: 'cambiarol', args: '<personaje>', category: 'Registro', description: 'Solicita cambiar tu personaje.' },
  { name: 'team', args: '', category: 'Gestión', description: 'Muestra la información del team.' },
  { name: 'miembros', args: '', category: 'Gestión', description: 'Lista a los integrantes del grupo.' },
  { name: 'afk', args: '<motivo>', category: 'Gestión', description: 'Activa tu estado de ausencia.' },
  { name: 'inactivos', args: '', category: 'Gestión', description: 'Muestra integrantes inactivos.' },
  { name: 'reservar', args: '', category: 'Personajes', description: 'Reserva un personaje disponible.' },
  { name: 'liberar', args: '', category: 'Personajes', description: 'Libera tu personaje.' },
  { name: 'perfil', args: '<@usuario>', category: 'Interacción', description: 'Muestra el perfil de un integrante.' },
  { name: 'pareja', args: '<@usuario>', category: 'Interacción', description: 'Envía una propuesta de pareja.' },
  { name: 'rechazar', args: '', category: 'Interacción', description: 'Rechaza una propuesta de pareja.' },
  { name: 'ship', args: '<@usuario> <@usuario>', category: 'Interacción', description: 'Calcula la compatibilidad entre dos personas.' },
  { name: 'reglas', args: '', category: 'Interacción', description: 'Muestra las reglas del grupo.' },
  { name: 'admins', args: '', category: 'Interacción', description: 'Muestra a los administradores del grupo.' },
  { name: 'add', args: '', category: 'Administración', description: 'Añade un integrante al grupo.' },
  { name: 'expulsar', args: '', category: 'Administración', description: 'Expulsa a un integrante del grupo.' },
  { name: 'ban', args: '', category: 'Administración', description: 'Bloquea a un integrante del bot.' },
  { name: 'unban', args: '', category: 'Administración', description: 'Retira el bloqueo de un integrante.' },
  { name: 'resetrol', args: '', category: 'Administración', description: 'Libera el personaje de otro integrante.' },
  { name: 'warn', args: '', category: 'Administración', description: 'Añade una advertencia.' },
  { name: 'unwarn', args: '', category: 'Administración', description: 'Retira una advertencia.' },
  { name: 'acceptrol', args: '', category: 'Administración', description: 'Aprueba una solicitud de personaje.' },
  { name: 'denyrol', args: '', category: 'Administración', description: 'Rechaza una solicitud de personaje.' },
  { name: 'anuncio', args: '', category: 'Administración', description: 'Envía un anuncio al grupo.' },
  { name: 'close', args: '', category: 'Administración', description: 'Cierra el grupo para participantes.' },
  { name: 'open', args: '', category: 'Administración', description: 'Abre el grupo para participantes.' },
];

const MENU_TEMPLATE = `ㅤ➢ㅤ◢𝟔𝟔 ; 𝟕𝟕◣ㅤ禍...ㅤ𝐁𝐎𝐓𝐒
ㅤ⌞ㅤ≪⁹⁹ㅤ⁙ㅤ𝐕𝐄́𝐑𝐒𝐎𝐕𝐀ㅤ◌

ㅤㅤㅤㅤ𓆩 ☕ 𓆪
ㅤㅤㅤ𝓜𝓮𝓷𝓾 𝓭𝓮 𝓬𝓸𝓶𝓪𝓷𝓭𝓸𝓼
ㅤㅤㅤㅤ( ᵕ ᴗ ᵕ )♡

ㅤㅤ࿙ׄ࿚᮫᜔۬፟֟࿙ׄ࿚

🥢ㅤ׃ㅤ ~𝕴𝐍𝐅𝐎𝐑𝐌𝐀𝐂𝐈𝐎𝐍~ ㅤ׃
ㅤㅤ𓂃 𝖻𝗈𝗍 𝗂𝗇𝖿𝗈𝗋𝗆𝖺𝗍𝗂𝗈𝗇 𓂃

ㅤ𖦹ㅤ𝖭𝖺𝗆𝖾ㅤ⁙ㅤᴠᴇ́ʀsᴏᴠᴀ
ㅤ𖦹ㅤ𝖳𝖾𝖺𝗆ㅤ⁙    ◢禍◣ 𝐕𝖊𝖗𝖘𝖔𝐯𝖆 ࿙☕࿚
ㅤ𖦹ㅤ𝖯𝗋𝖾𝖿𝗂𝗑ㅤ⁙ㅤ.
ㅤ𖦹ㅤ𝖲𝗍𝖺𝗍𝗎𝗌ㅤ⁙ㅤᴏɴʟɪɴᴇ
ㅤ𖦹ㅤ𝖵𝖾𝗋𝗌𝗂𝗈𝗇ㅤ⁙ㅤ𝟷.𝟶

ㅤㅤㅤ(˶ᵔ ᵕ ᵔ˶) .ᐟ
ㅤㅤ࿚ׄ࿙ֹ࿚᮫᜔۬፟֟࿙ֹ࿚ׄ࿙

ㅤㅤㅤ◢ 𝟎𝟏 ◣
⸸ㅤ׃ㅤ ~𝕽𝐄𝐆𝐈𝐒𝐓𝐑𝐎~ ㅤ׃
ㅤㅤ𓂃 𝗆𝖾𝗆𝖻𝖾𝗋 𝗋𝖾𝗀𝗂𝗌𝗍𝗋𝖺𝗍𝗂𝗈𝗇 𓂃
ㅤㅤㅤ(｡•̀ᴗ-)✧

{{cmd:reg}}
{{cmd:unreg}}
{{cmd:rol}}
{{cmd:roles}}
{{cmd:ficha}}
{{cmd:editar}}
{{cmd:mirol}}
{{cmd:cambiarol}}

ㅤㅤ࿙☕࿚ㅤ𓆩 ♱ 𓆪
ㅤㅤㅤ( ᴗ͈ˬᴗ͈)ㅤ⁙
ㅤㅤ࿚ׄ࿙ֹ࿚᮫᜔۬፟֟࿙ֹ࿚ׄ࿙

ㅤㅤㅤ◢ 𝟎𝟐 ◣
𖤐ㅤ׃ㅤ ~𝕲𝐄𝐒𝐓𝐈𝐎𝐍~ ㅤ׃
ㅤㅤ𓂃 𝗍𝖾𝖺𝗆 𝗆𝖺𝗇𝖺𝗀𝖾𝗆𝖾𝗇𝗍 𓂃
ㅤㅤㅤ(๑˃̵ᴗ˂̵)و

{{cmd:team}}
{{cmd:miembros}}
{{cmd:afk}}
{{cmd:inactivos}}

ㅤㅤ࿙🥢࿚ㅤ𓆩 ♱ 𓆪
ㅤㅤㅤ(˶˃ ᵕ ˂˶)ㅤ⁙
ㅤㅤ࿚ׄ࿙ֹ࿚᮫᜔۬፟֟࿙ֹ࿚ׄ࿙

ㅤㅤㅤ◢ 𝟎𝟑 ◣
☕ㅤ׃ㅤ ~𝕻𝐄𝐑𝐒𝐎𝐍𝐀𝐉𝐄𝐒~ ㅤ׃
ㅤㅤ𓂃 𝗋𝗈𝗅𝖾 𝗌𝗒𝗌𝗍𝖾𝗆 𓂃
ㅤㅤㅤ( ੭ ˙ᗜ˙ )੭

{{cmd:reservar}}
{{cmd:liberar}}

ㅤㅤ࿙𖤐࿚ㅤ𓆩 ♱ 𓆪
ㅤㅤㅤ( ᵕ ᴗ ᵕ )ㅤ⁙
ㅤㅤ࿚ׄ࿙ֹ࿚᮫᜔۬፟֟࿙ֹ࿚ׄ࿙

ㅤㅤㅤ◢ 𝟎𝟒 ◣
🥢ㅤ׃ㅤ ~𝕴𝐍𝐓𝐄𝐑𝐀𝐂𝐂𝐈𝐎𝐍~ ㅤ׃
ㅤㅤ𓂃 𝗌𝗈𝖼𝗂𝖺𝗅 & 𝖿𝗎𝗇 𓂃
ㅤㅤㅤ(づ๑•ᴗ•๑)づ♡

{{cmd:perfil}}
{{cmd:pareja}}
{{cmd:rechazar}}
{{cmd:ship}}
{{cmd:reglas}}
{{cmd:admins}}

ㅤㅤ࿙☕࿚ㅤ𓆩 ♱ 𓆪
ㅤㅤㅤ(っ˘ω˘ς)ㅤ⁙
ㅤㅤ࿚ׄ࿙ֹ࿚᮫᜔۬፟֟࿙ֹ࿚ׄ࿙

ㅤㅤㅤ◢ 𝟎𝟓 ◣
⛓️ㅤ׃ㅤ ~𝕬𝐃𝐌𝐈𝐍𝐈𝐒𝐓𝐑𝐀𝐂𝐈𝐎𝐍~ ㅤ׃
ㅤㅤ𓂃 𝗌𝗍𝖺𝖿𝖿 𝗈𝗇𝗅𝗒 𓂃
ㅤㅤㅤ( •̀ - •́ )✧

{{cmd:add}}
{{cmd:expulsar}}
{{cmd:ban}}
{{cmd:unban}}
{{cmd:resetrol}}
{{cmd:warn}}
{{cmd:unwarn}}
{{cmd:acceptrol}}
{{cmd:denyrol}}
{{cmd:anuncio}}
{{cmd:close}}
{{cmd:open}}

ㅤㅤ࿚ׄ࿙ֹ࿚᮫᜔۬፟֟࿙ֹ࿚ׄ࿙

ㅤㅤㅤ𓆩ㅤ禍ㅤ𓆪
ㅤㅤ ~𝕰𝐍𝐃 𝐎𝐅 𝐌𝐄𝐍𝐔~
ㅤㅤㅤ( ᴗ͈ˬᴗ͈) ♡

ㅤㅤ𝖸𝗈𝗎𝗋 𝗋𝗈𝗅𝖾 𝗂𝗌 𝗒𝗈𝗎𝗋 𝗂𝖽𝖾𝗇𝗍𝗂𝗍𝗒.
ㅤㅤ𝖸𝗈𝗎

𝗋 𝗍𝖾𝖺𝗆 𝗂𝗌 𝗒𝗈𝗎𝗋 𝗌𝗍𝗈𝗋𝗒.

ㅤ⌞ㅤ≪⁹⁹ㅤ⁙ㅤ𝐕𝐄́𝐑𝐒𝐎𝐕𝐀
ㅤㅤㅤ𝖾𝗌𝗍.ㅤ𝟐𝟎𝟐𝟔

ㅤㅤ࿙ׄ࿚ㅤ𓆩 ☕ 𝟔𝟔 ; 𝟕𝟕𓆪ㅤ࿙ׄ࿚`;

export interface CommandInventoryItem extends MenuCommandDefinition {
  implemented: boolean;
  enabled: boolean;
  visible: boolean;
  inTemplate: boolean;
  aliases: string[];
  usage: string;
}

const MENU_COMMAND_NAMES = new Set(MENU_COMMANDS.map((command) => command.name));

export function knownCommandNames(): string[] {
  return [...new Set([...MENU_COMMAND_NAMES, 'menu', ...allCommands().map((command) => command.name)])];
}

export function getCommandInventory(settings: CommandSettings = getCommandSettings()): CommandInventoryItem[] {
  const realCommands = new Map(allCommands().map((command) => [command.name, command]));
  const definitions = [...MENU_COMMANDS];
  const allNames = new Set(definitions.map((command) => command.name));

  for (const command of allCommands()) {
    if (!allNames.has(command.name)) {
      definitions.push({
        name: command.name,
        args: command.usage.replace(/^\.[a-z0-9_-]+\s*/i, ''),
        category: command.category,
        description: command.description,
      });
      allNames.add(command.name);
    }
  }

  if (!allNames.has('menu')) {
    definitions.push({ name: 'menu', args: '', category: 'General', description: 'Muestra el menú de comandos.' });
  }

  return definitions.map((definition) => {
    const real = realCommands.get(definition.name);
    const inTemplate = MENU_COMMAND_NAMES.has(definition.name);
    const aliases = settings.aliases[definition.name] ?? [];
    return {
      ...definition,
      implemented: Boolean(real),
      enabled: Boolean(real) && !settings.disabled.includes(definition.name),
      visible: inTemplate && !settings.hidden.includes(definition.name),
      inTemplate,
      aliases,
      usage: real?.usage ?? `.${definition.name}${definition.args ? ` ${definition.args}` : ''}`,
    };
  });
}

function renderCommand(name: string, settings: CommandSettings): string {
  if (settings.hidden.includes(name)) return '';
  const definition = MENU_COMMANDS.find((command) => command.name === name);
  if (!definition) return '';

  // Esta línea reproduce el espaciado particular del menú de referencia.
  const decoration = name === 'roles' && settings.commandDecoration === DEFAULT_COMMAND_DECORATION
    ? '    ୨ৎㅤ.'
    : settings.commandDecoration;
  const args = definition.args ? ` ${definition.args}` : '';
  const aliases = settings.aliases[name] ?? [];
  const aliasText = aliases.length ? ` 〔alias: ${aliases.map((alias) => `.${alias}`).join(', ')}〕` : '';
  const trailingSpace = name === 'roles' && settings.commandDecoration === DEFAULT_COMMAND_DECORATION ? ' ' : '';
  return `${decoration}${name}${args}${aliasText}${trailingSpace}`;
}

export function renderMenuText(bannerText = '', settings: CommandSettings = getCommandSettings()): string {
  const banner = bannerText.replace(/^\n+|\n+$/g, '') || DEFAULT_BANNER_TEXT;
  const body = MENU_TEMPLATE.replace(/\{\{cmd:([a-z0-9_-]+)\}\}/g, (_token, name: string) => renderCommand(name, settings));
  return `${banner}\n\n${body}`;
}
