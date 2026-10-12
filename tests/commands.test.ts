import { describe, expect, it } from 'vitest';
import '../src/commands/index.js';
import { DEFAULT_COMMAND_SETTINGS, normalizeCommandSettings } from '../src/core/command-settings.js';
import { getCommandInventory, renderMenuText } from '../src/commands/catalog.js';

describe('configuración del catálogo de comandos', () => {
  const active = ['reg', 'menu'];
  const known = ['reg', 'menu', 'team'];

  it('registra cada comando implementado desde su propio archivo', () => {
    const inventory = getCommandInventory();
    // Todos los comandos del menú tienen módulo propio: ninguno queda pendiente.
    expect(inventory.filter((command) => !command.implemented)).toEqual([]);
    expect(inventory.some((command) => command.name === 'menu' && command.implemented)).toBe(true);
    expect(inventory.some((command) => command.name === 'anuncio' && command.implemented)).toBe(true);
  });

  it('usa valores por defecto seguros para el formato del menú', () => {
    expect(DEFAULT_COMMAND_SETTINGS.commandDecoration).toBe('ㅤ୨ৎㅤ.');
    expect(DEFAULT_COMMAND_SETTINGS.disabled).toEqual([]);
    expect(DEFAULT_COMMAND_SETTINGS.hidden).toEqual([]);
  });

  it('normaliza alias y estados de comandos', () => {
    expect(normalizeCommandSettings({
      commandDecoration: '» .',
      disabled: ['reg'],
      hidden: ['team'],
      aliases: { reg: ['alta', 'inscribir'] },
    }, active, known)).toEqual({
      commandDecoration: '» .',
      disabled: ['reg'],
      hidden: ['team'],
      aliases: { reg: ['alta', 'inscribir'] },
    });
  });

  it('rechaza alias duplicados, nombres de comando y saltos de línea', () => {
    expect(() => normalizeCommandSettings({
      commandDecoration: '.', disabled: [], hidden: [], aliases: { reg: ['menu'] },
    }, active, known)).toThrow('ya es el nombre de un comando');
    expect(() => normalizeCommandSettings({
      commandDecoration: '.', disabled: [], hidden: [], aliases: { reg: ['help'], menu: ['help'] },
    }, active, known)).toThrow('ya está asignado');
    expect(() => normalizeCommandSettings({
      commandDecoration: 'línea\nextra', disabled: [], hidden: [], aliases: {},
    }, active, known)).toThrow('saltos de línea');
  });

  it('genera el menú con el diseño y los comandos indicados', () => {
    const menu = renderMenuText();
    expect(menu).toContain('ㅤㅤㅤㅤۖㅤㅤㅤㅤㅤۖ');
    expect(menu).toContain('𝓜𝓮𝓷𝓾 𝓭𝓮 𝓬𝓸𝓶𝓪𝓷𝓭𝓸𝓼');
    expect(menu).toContain('ㅤ୨ৎㅤ.reg <nombre.edad>');
    expect(menu).toContain('ㅤ୨ৎㅤ.ship <@usuario> <@usuario>');
    expect(menu).toContain('ㅤ୨ৎㅤ.open');
    expect(menu).toContain('𝖸𝗈𝗎𝗋 𝗋𝗈𝗅𝖾 𝗂𝗌 𝗒𝗈𝗎𝗋 𝗂𝖽𝖾𝗇𝗍𝗂𝗍𝗒.');
  });

  it('aplica decoración, alias y ocultación a la vista del menú', () => {
    const menu = renderMenuText('', {
      commandDecoration: '➤ ',
      disabled: [],
      hidden: ['reg'],
      aliases: { rol: ['personaje'] },
    });
    expect(menu.split('\n')).not.toContain('➤ reg <nombre.edad>');
    expect(menu).toContain('➤ rol <personaje> 〔alias: .personaje〕');
  });
});
