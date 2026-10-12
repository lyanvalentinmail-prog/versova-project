import { describe, expect, it } from 'vitest';
import { maskPhone, normalizeKey, parseCharacterName, parseNameAge } from '../src/utils/text.js';
import { hit } from '../src/utils/ratelimit.js';

describe('parseNameAge (.reg / .editar)', () => {
  it('acepta nombre.edad', () => {
    expect(parseNameAge('Moon.17')).toEqual({ ok: true, value: { name: 'Moon', age: 17 } });
    expect(parseNameAge('Luna Sol.18')).toEqual({ ok: true, value: { name: 'Luna Sol', age: 18 } });
  });
  it('rechaza nombre vacío, edad no numérica y fuera de rango', () => {
    expect(parseNameAge('.17').ok).toBe(false);
    expect(parseNameAge('Moon.diecisiete').ok).toBe(false);
    expect(parseNameAge('Moon.0').ok).toBe(false);
    expect(parseNameAge('Moon.200').ok).toBe(false);
    expect(parseNameAge('Moon').ok).toBe(false);
  });
  it('rechaza caracteres raros en el nombre', () => {
    expect(parseNameAge('<script>.17').ok).toBe(false);
  });
});

describe('personajes y claves', () => {
  it('normaliza tildes y mayúsculas para evitar duplicados', () => {
    expect(normalizeKey('  Félix  ')).toBe(normalizeKey('felix'));
  });
  it('valida nombres de personaje', () => {
    expect(parseCharacterName('   ').ok).toBe(false);
    expect(parseCharacterName('Felix').ok).toBe(true);
  });
});

describe('privacidad', () => {
  it('no muestra el número completo', () => {
    const masked = maskPhone('59899123456@s.whatsapp.net');
    expect(masked).not.toContain('99123');
    expect(masked.endsWith('3456')).toBe(true);
  });
});

describe('límite de uso', () => {
  it('bloquea al superar el máximo dentro de la ventana', () => {
    const key = `k-${Math.random()}`;
    expect(hit(key, 2, 10_000)).toBe(true);
    expect(hit(key, 2, 10_000)).toBe(true);
    expect(hit(key, 2, 10_000)).toBe(false);
  });
});
