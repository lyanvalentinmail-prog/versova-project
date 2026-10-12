import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { JSDOM, VirtualConsole } from 'jsdom';
import { describe, expect, it } from 'vitest';

/**
 * Abre cada página real de la plataforma en un navegador simulado (jsdom), con la API
 * simulada a partir de las respuestas reales del servidor, y comprueba que el HTML, el
 * armazón (shell.js) y la lógica de la página (app.js) funcionan sin errores.
 */

const here = dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = join(here, '../src/web/public');
const FIXTURES = JSON.parse(readFileSync(join(here, 'fixtures/api.json'), 'utf8')) as Record<string, unknown>;

interface PageResult {
  dom: JSDOM;
  text: () => string;
  errores: string[];
}

/** Respuestas de la API: se busca la ruta más larga que coincida (p. ej. /api/auth/me antes de /api/auth). */
function responseFor(pathname: string): { status: number; body: unknown } {
  const keys = Object.keys(FIXTURES)
    .filter((key) => pathname === key || pathname.startsWith(`${key}/`) || pathname.startsWith(`${key}?`))
    .sort((a, b) => b.length - a.length);
  if (!keys.length) return { status: 404, body: { error: `Sin datos simulados para ${pathname}` } };
  return { status: 200, body: FIXTURES[keys[0]] };
}

async function openPage(page: string, search = ''): Promise<PageResult> {
  const errores: string[] = [];
  const virtualConsole = new VirtualConsole();
  virtualConsole.on('jsdomError', (error) => {
    // jsdom no implementa la navegación entre documentos: las redirecciones del panel
    // (por ejemplo cuando no hay sesión) se registran como aviso, no como fallo.
    if (error.message.includes('Not implemented')) return;
    errores.push(`jsdom: ${error.message}`);
  });
  virtualConsole.on('error', (message) => errores.push(`console.error: ${String(message)}`));

  const dom = await JSDOM.fromFile(join(PUBLIC_DIR, page), {
    runScripts: 'dangerously',
    resources: 'usable',
    pretendToBeVisual: true,
    url: `${pathToFileURL(join(PUBLIC_DIR, page)).href}${search}`,
    virtualConsole,
    beforeParse(window) {
      window.addEventListener('error', (event) => errores.push(`error: ${event.message}`));
      window.addEventListener('unhandledrejection', (event) => errores.push(`rejection: ${String(event.reason)}`));
      window.matchMedia = ((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        addListener: () => undefined,
        removeListener: () => undefined,
        dispatchEvent: () => false,
      })) as unknown as typeof window.matchMedia;
      window.scrollTo = () => undefined;
      window.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
        const raw = typeof input === 'string' ? input : input instanceof URL ? input.pathname : String((input as Request).url);
        const parsed = new URL(raw, 'http://localhost/');
        // La ruta incluye la consulta: los fixtures pueden especializar `?bot=raiden`.
        const pathname = `${parsed.pathname}${parsed.search}`;
        const { status, body } = responseFor(pathname);
        const method = (init?.method ?? 'GET').toUpperCase();
        // Las escrituras responden igual: lo que se comprueba es el dibujado de la página.
        return {
          ok: status < 400,
          status,
          headers: new Map([['content-type', 'application/json']]) as unknown as Headers,
          json: async () => body,
          text: async () => JSON.stringify(body),
          method,
        } as unknown as Response;
      }) as typeof window.fetch;
      class FakeEventSource {
        onmessage: ((event: { data: string }) => void) | null = null;
        onerror: (() => void) | null = null;
        constructor(public url: string) {}
        close() {
          /* sin recursos que liberar */
        }
      }
      (window as unknown as { EventSource: unknown }).EventSource = FakeEventSource;
    },
  });

  await new Promise<void>((resolve) => {
    if (dom.window.document.readyState === 'complete') resolve();
    else dom.window.addEventListener('load', () => resolve());
  });
  // Margen para las promesas de renderizado (fetch + pintado).
  await new Promise((resolve) => setTimeout(resolve, 400));
  return { dom, text: () => dom.window.document.body.textContent ?? '', errores };
}

describe('páginas de la plataforma en el navegador', () => {
  it('la portada dibuja el armazón, los contadores y el acceso', async () => {
    const { dom, text, errores } = await openPage('index.html');
    expect(errores).toEqual([]);
    expect(text()).toContain('VÉRSOVA');
    expect(dom.window.document.getElementById('statCommands')?.textContent).toContain('34');
    expect(dom.window.document.getElementById('authModal')).toBeTruthy();
    expect(dom.window.document.getElementById('serverList')?.children.length).toBeGreaterThan(0);
    // El armazón (shell.js) queda disponible para las páginas.
    expect(dom.window.eval('typeof V')).toBe('object');
  });

  it('el asistente de registro muestra las instancias y los pasos', async () => {
    const { dom, text, errores } = await openPage('registrar.html');
    expect(errores).toEqual([]);
    expect(text()).toContain('Elige tu instancia');
    expect(dom.window.document.getElementById('instanceOptions')?.children.length).toBeGreaterThan(0);
    expect(dom.window.document.getElementById('pasoPill')?.textContent).toContain('Paso 1');
  });

  it('«Mis Bots» lista los bots de la cuenta y sus opciones', async () => {
    const { dom, text, errores } = await openPage('bots.html');
    expect(errores).toEqual([]);
    expect(text()).toContain('Bot Demo');
    const lista = dom.window.document.getElementById('botsList')?.textContent ?? '';
    expect(lista).toContain('SUBBOT');
    expect(lista).toContain('prefijo');
    expect(lista).toContain('Config');
    // Cada tarjeta dice a qué bot del catálogo pertenece y de dónde sale su código.
    expect(lista).toContain('VÉRSOVA Rol');
    expect(lista).toContain('src/commands');
    // Un SubBot de otro bot del catálogo ofrece «⚡ Usar bot» para ponerlo a responder.
    expect(lista).toContain('Raiden de Ana');
    expect(lista).toContain('bots/raiden-wabot');
    expect(lista).toContain('⚡ Raiden WaBot');
    // El ícono y el texto van en nodos distintos: el botón se lee «⚡Usar bot».
    expect(lista).toContain('Usar bot');
    expect(dom.window.document.getElementById('optPrefixes')).toBeTruthy();
    expect(dom.window.document.getElementById('saveBotOptions')).toBeTruthy();
  });

  it('la tienda muestra el catálogo de bots (con los repos de GitHub) y los artículos gratis', async () => {
    const { dom, text, errores } = await openPage('store.html');
    expect(errores).toEqual([]);
    expect(text()).toContain('Catálogo de bots');
    expect(dom.window.document.getElementById('catalogList')?.textContent).toContain('VÉRSOVA');
    expect(dom.window.document.getElementById('catalogList')?.textContent).toContain('Raiden WaBot');
    expect(dom.window.document.getElementById('catalogList')?.textContent).toContain('Yae Miku Bot');
    expect(dom.window.document.getElementById('storeItems')?.textContent).toContain('Token');
  });

  it('cada bot del catálogo ofrece crearlo, usarlo, ver su carpeta y su repo', async () => {
    const { dom, errores } = await openPage('store.html');
    expect(errores).toEqual([]);
    const catalogo = dom.window.document.getElementById('catalogList')?.textContent ?? '';
    // «Crear este bot» y «Usar este bot» conviven con la carpeta y el enlace a GitHub.
    expect(catalogo).toContain('＋ Crear este bot');
    expect(catalogo).toContain('Registrar con asistente');
    expect(catalogo).toContain('bots/raiden-wabot');
    expect(catalogo).toContain('bots/yae-miku-bot');
    expect(catalogo).toContain('103 comandos');
    const enlaces = [...dom.window.document.querySelectorAll('#catalogList a[href*="github.com"]')];
    expect(enlaces.map((a) => (a as HTMLAnchorElement).href)).toEqual(
      expect.arrayContaining(['https://github.com/Ryuzei-Ts/Raiden-WaBot']),
    );
  });

  it('el asistente arranca con el bot elegido y sabe crear ese bot', async () => {
    const { dom, errores } = await openPage('registrar.html', '?bot=raiden');
    expect(errores).toEqual([]);
    const tipos = dom.window.document.getElementById('botTypeOptions');
    expect(tipos?.children.length).toBe(3);
    expect(dom.window.document.getElementById('pasoPill')?.textContent).toContain('Paso 1 de 6');
    // El alias del catálogo (`raiden`) deja elegido el pack `raiden-wabot`.
    const activa = tipos?.querySelector('.select-card.is-active')?.textContent ?? '';
    expect(activa).toContain('Raiden WaBot');
    expect(dom.window.document.getElementById('botTypeHint')?.textContent).toContain('https://github.com/Ryuzei-Ts/Raiden-WaBot');
    expect(tipos?.textContent).toContain('bots/raiden-wabot');
  });

  it('el catálogo de comandos tiene una pestaña por bot', async () => {
    const { dom, errores } = await openPage('cmds.html', '?bot=yae-miku');
    expect(errores).toEqual([]);
    const tabs = dom.window.document.getElementById('botTabs');
    expect(tabs?.children.length).toBe(3);
    expect(tabs?.querySelector('.tab.is-active')?.textContent).toContain('Yae Miku Bot');
    expect(dom.window.document.getElementById('cmdBot')?.textContent).toContain('Yae Miku Bot');
    expect(dom.window.document.getElementById('botHint')?.textContent).toContain('bots/yae-miku-bot');
    // El inventario es el del pack pedido: 8 propios + los 34 del núcleo (uno reemplazado).
    expect(dom.window.document.getElementById('cmdCount')?.textContent).toContain('41');
    expect(dom.window.document.getElementById('cmdImplemented')?.textContent).toContain('41');
    expect(dom.window.document.getElementById('cmdPending')?.textContent).toContain('0');
  });

  it('las métricas muestran los servidores y la telemetría', async () => {
    const { dom, text, errores } = await openPage('metrics.html');
    expect(errores).toEqual([]);
    expect(dom.window.document.getElementById('mServers')?.textContent).toContain('Vrsov Srv');
    expect(dom.window.document.getElementById('mCpu')?.textContent).not.toBe('');
    expect(text()).toContain('CPU');
  });

  it('el catálogo de comandos lista las categorías y los 34 comandos', async () => {
    const { dom, text, errores } = await openPage('cmds.html');
    expect(errores).toEqual([]);
    expect(text()).toContain('Catálogo completo');
    expect(text()).toContain('Administración');
    expect(dom.window.document.getElementById('cmdCount')?.textContent).toContain('34');
    expect(dom.window.document.getElementById('commandsList')?.children.length).toBeGreaterThan(30);
  });

  it('los enlaces muestran el canal y los colaboradores', async () => {
    const { dom, text, errores } = await openPage('links.html');
    expect(errores).toEqual([]);
    expect(text()).toContain('Canal');
    expect(dom.window.document.getElementById('linksList')?.children.length).toBeGreaterThan(0);
  });

  it('la página del menú muestra la rejilla de secciones', async () => {
    const { dom, text, errores } = await openPage('menu.html');
    expect(errores).toEqual([]);
    expect(text()).toContain('Menú');
    const grid = dom.window.document.getElementById('menuGrid')?.textContent ?? '';
    expect(grid).toContain('Mis Bots');
    expect(grid).toContain('Tienda');
    expect(dom.window.document.getElementById('menuGrid')?.children.length).toBeGreaterThan(5);
  });

  it('el soporte muestra el formulario y la bandeja de envíos', async () => {
    const { dom, text, errores } = await openPage('ticket.html');
    expect(errores).toEqual([]);
    expect(text()).toContain('Sugerencia');
    expect(dom.window.document.getElementById('reportForm')).toBeTruthy();
    expect(dom.window.document.getElementById('reportsList')).toBeTruthy();
  });
});
