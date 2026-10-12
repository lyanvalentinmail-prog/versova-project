import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

/**
 * Ejecuta el app.js real del panel con un DOM mínimo y un fetch simulado,
 * para comprobar el comportamiento del bloque de emparejamiento en el navegador.
 */

const here = dirname(fileURLToPath(import.meta.url));
const APP_SOURCE = readFileSync(join(here, '../src/web/public/app.js'), 'utf8');

type FakeElement = Record<string, unknown> & {
  children: FakeElement[];
  hidden: boolean;
  disabled: boolean;
  textContent: string;
  value: string;
  className: string;
  classList: { add: (...c: string[]) => void; remove: (...c: string[]) => void; contains: (c: string) => boolean };
  dispatch: (type: string, event?: Record<string, unknown>) => void;
};

function makeElement(tag = 'div'): FakeElement {
  const listeners = new Map<string, Array<(event: Record<string, unknown>) => void>>();
  const el = {
    tagName: tag.toUpperCase(),
    children: [] as FakeElement[],
    hidden: false,
    disabled: false,
    textContent: '',
    innerHTML: '',
    value: '',
    placeholder: '',
    className: '',
    files: [],
    checked: false,
    type: '',
    title: '',
    src: '',
    style: {},
    dataset: {},
    scrollTop: 0,
    scrollHeight: 0,
    classList: {
      add: (...names: string[]) => {
        el.className = [...new Set([...el.className.split(' '), ...names])].filter(Boolean).join(' ');
      },
      remove: (...names: string[]) => {
        el.className = el.className.split(' ').filter((name) => name && !names.includes(name)).join(' ');
      },
      toggle: (name: string) => (el.classList.contains(name) ? el.classList.remove(name) : el.classList.add(name)),
      contains: (name: string) => el.className.split(' ').includes(name),
    },
    setAttribute: (key: string, value: unknown) => {
      (el as Record<string, unknown>)[key] = value;
    },
    getAttribute: (key: string) => (el as Record<string, unknown>)[key] ?? null,
    removeAttribute: (key: string) => {
      delete (el as Record<string, unknown>)[key];
    },
    addEventListener: (type: string, fn: (event: Record<string, unknown>) => void) => {
      listeners.set(type, [...(listeners.get(type) ?? []), fn]);
    },
    removeEventListener: () => undefined,
    dispatch: (type: string, event: Record<string, unknown> = {}) => {
      for (const fn of listeners.get(type) ?? []) fn(event);
    },
    append: (...nodes: FakeElement[]) => {
      el.children.push(...nodes);
    },
    replaceChildren: (...nodes: FakeElement[]) => {
      el.children = [...nodes];
    },
    remove: () => undefined,
    querySelector: () => makeElement('span'),
    querySelectorAll: () => [],
    click: () => el.dispatch('click'),
    focus: () => undefined,
  } as unknown as FakeElement;

  Object.defineProperty(el, 'childElementCount', { get: () => el.children.length });
  Object.defineProperty(el, 'firstElementChild', { get: () => el.children[0] ?? null });
  return el;
}

const state: {
  elements: Map<string, FakeElement>;
  status: Record<string, unknown>;
  pairResponse: { status: number; body: Record<string, unknown> };
  timers: NodeJS.Timeout[];
} = {
  elements: new Map(),
  status: {},
  pairResponse: { status: 200, body: {} },
  timers: [],
};

function element(id: string): FakeElement {
  const found = state.elements.get(id);
  if (found) return found;
  const created = makeElement();
  state.elements.set(id, created);
  return created;
}

function buildSandbox(): Record<string, unknown> {
  const document = {
    documentElement: { dataset: {} as Record<string, string> },
    getElementById: (id: string) => element(id),
    createElement: (tag: string) => makeElement(tag),
    querySelector: () => makeElement('meta'),
    querySelectorAll: () => [],
    addEventListener: () => undefined,
  };

  const responses: Record<string, Record<string, unknown>> = {
    '/api/status': state.status,
    '/api/banner': { text: '', defaultText: 'VÉRSOVA', hasImage: false, imageMime: null },
    '/api/commands': {
      settings: { commandDecoration: 'ㅤ୨ৎㅤ.', disabled: [], hidden: [], aliases: {} },
      commands: [],
    },
    '/api/menu': { text: '.menu' },
  };

  const fetchStub = async (path: string, options: { method?: string } = {}) => {
    if (path === '/api/pair' && options.method === 'POST') {
      return {
        ok: state.pairResponse.status < 400,
        status: state.pairResponse.status,
        json: async () => state.pairResponse.body,
      };
    }
    return { ok: true, status: 200, json: async () => responses[path] ?? {} };
  };

  class EventSourceStub {
    onmessage: ((event: { data: string }) => void) | null = null;
    onerror: (() => void) | null = null;
    close(): void {
      /* noop */
    }
  }

  const sandbox: Record<string, unknown> = {
    addEventListener: () => undefined,
    document,
    localStorage: { getItem: () => null, setItem: () => undefined },
    matchMedia: () => ({ matches: false }),
    fetch: fetchStub,
    EventSource: EventSourceStub,
    FileReader: class {},
    confirm: () => true,
    alert: () => undefined,
    console,
    Date,
    Math,
    JSON,
    Set,
    Map,
    Object,
    Array,
    String,
    Number,
    Boolean,
    Promise,
    Error,
    setTimeout: (fn: () => void, ms: number) => setTimeout(fn, ms),
    clearTimeout: (id: NodeJS.Timeout) => clearTimeout(id),
    setInterval: (fn: () => void, ms: number) => {
      const id = setInterval(fn, ms);
      state.timers.push(id);
      return id;
    },
    clearInterval: (id: NodeJS.Timeout) => clearInterval(id),
  };
  sandbox.window = sandbox;
  return sandbox;
}

type Panel = {
  requestPairingCode: () => Promise<void>;
  renderPairingCode: () => void;
  renderPairingControls: (status: Record<string, unknown>) => void;
};

const loadPanel = (): Panel =>
  runInNewContext(
    `${APP_SOURCE}
;({ requestPairingCode, renderPairingCode, renderPairingControls });`,
    buildSandbox() as never,
  ) as Panel;

let panel: ReturnType<typeof loadPanel>;

beforeEach(async () => {
  state.elements = new Map();
  state.timers = [];
  state.status = {
    bot: 'VÉRSOVA',
    team: 'team',
    version: '1.0',
    whatsapp: 'qr',
    me: null,
    qr: 'data:image/png;base64,AA',
    pairingCode: null,
    pairingExpiresAt: null,
    pairingReady: true,
    linked: false,
    uptimeSec: 5,
  };
  state.pairResponse = { status: 200, body: { code: 'ABCD-1234', expiresAt: Date.now() + 60_000 } };
  panel = loadPanel();
  await new Promise((resolve) => setTimeout(resolve, 20));
});

afterEach(() => {
  for (const id of state.timers) clearInterval(id);
  state.timers = [];
});

describe('panel de emparejamiento', () => {
  it('muestra el código con su cuenta regresiva al pedirlo', async () => {
    element('phone').value = '+598 99 000 111';
    await panel.requestPairingCode();

    expect(element('pairCode').hidden).toBe(false);
    expect(element('pairCode').textContent).toBe('ABCD-1234');
    expect(element('pairCountdown').hidden).toBe(false);
    expect(element('pairCountdown').textContent).toContain('Expira en 60 s');
    expect(element('pairError').hidden).toBe(true);
  });

  it('muestra el motivo del rechazo y no deja un código en pantalla', async () => {
    state.pairResponse = {
      status: 400,
      body: { error: 'WhatsApp rechazó la solicitud de emparejamiento (400 bad-request).' },
    };
    element('phone').value = '59899000111';
    await panel.requestPairingCode();

    expect(element('pairError').hidden).toBe(false);
    expect(element('pairError').textContent).toContain('rechazó la solicitud');
    expect(element('pairCode').hidden).toBe(true);
    expect(element('pair').disabled).toBe(false);
  });

  it('oculta el código y avisa cuando ya expiró', async () => {
    state.pairResponse = { status: 200, body: { code: 'VIEJ-0001', expiresAt: Date.now() - 1 } };
    await panel.requestPairingCode();

    expect(element('pairCode').hidden).toBe(true);
    expect(element('pairError').textContent).toContain('expiró');
  });

  it('deshabilita el botón mientras la conexión no acepta códigos', () => {
    panel.renderPairingControls({ pairingReady: false, linked: false });
    expect(element('pair').disabled).toBe(true);
    expect(element('pairHint').hidden).toBe(false);
    expect(element('pairHint').textContent).toContain('modo vinculación');

    panel.renderPairingControls({ pairingReady: true, linked: false });
    expect(element('pair').disabled).toBe(false);
    expect(element('pairHint').hidden).toBe(true);
  });

  it('avisa que el bot ya está vinculado', () => {
    panel.renderPairingControls({ pairingReady: true, linked: true });
    expect(element('pair').disabled).toBe(true);
    expect(element('pairHint').textContent).toContain('ya está vinculado');
  });

  it('pide el código con la tecla Enter', async () => {
    element('phone').value = '59899000111';
    element('phone').dispatch('keydown', { key: 'Enter', preventDefault: () => undefined });
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(element('pairCode').textContent).toBe('ABCD-1234');
  });
});
