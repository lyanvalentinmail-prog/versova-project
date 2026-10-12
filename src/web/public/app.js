/* =========================================================================
   VÉRSOVA · app.js — controladores de cada página de la plataforma
   ========================================================================= */

/* ------------------------------- estado ---------------------------------- */

const APP = {
  subbots: [],
  subbotsMeta: null,
  catalog: { bots: [], categories: [] },
  servers: [],
  economy: null,
  selectedInstance: 'subbot',
  selectedServer: 'vrsov-01',
  selectedMethod: 'code',
  wizardStep: 0,
  wizard: { instance: 'subbot', serverId: 'vrsov-01', serverName: '', phone: '', method: 'code', name: '', botId: null, tokenCode: '' },
  pairing: { code: null, expiresAt: null, timer: null },
  wizardPoll: null,
  wizardRun: 0,
  stream: null,
};

/* --------------------- emparejamiento del bot principal ------------------- */
/* Estas funciones las usa la tarjeta «Vinculación de WhatsApp» de la portada. */

function renderPairingCode(code, expiresAt) {
  const box = document.getElementById('pairCode');
  const countdown = document.getElementById('pairCountdown');
  const error = document.getElementById('pairError');
  if (error) {
    error.hidden = true;
    error.textContent = '';
  }
  if (!code || !expiresAt || expiresAt <= Date.now()) {
    if (box) {
      box.hidden = true;
      box.textContent = '';
    }
    if (countdown) countdown.hidden = true;
    if (error) {
      error.hidden = false;
      error.textContent = 'El código expiró. Pide uno nuevo.';
    }
    return false;
  }
  if (box) {
    box.hidden = false;
    box.textContent = code;
  }
  if (countdown) {
    countdown.hidden = false;
    const update = () => {
      const left = Math.max(0, Math.round((expiresAt - Date.now()) / 1000));
      countdown.textContent = `Expira en ${left} s`;
      if (left <= 0) {
        clearInterval(APP.pairing.timer);
        if (box) box.hidden = true;
        countdown.hidden = true;
        const err = document.getElementById('pairError');
        if (err) {
          err.hidden = false;
          err.textContent = 'El código expiró. Pide uno nuevo.';
        }
      }
    };
    clearInterval(APP.pairing.timer);
    update();
    APP.pairing.timer = setInterval(update, 1000);
  }
  return true;
}

function renderPairingControls(status = {}) {
  const button = document.getElementById('pair');
  const hint = document.getElementById('pairHint');
  const box = document.getElementById('pairCode');
  const countdown = document.getElementById('pairCountdown');
  const error = document.getElementById('pairError');
  if (!button) return;
  if (status.linked) {
    button.disabled = true;
    if (hint) {
      hint.hidden = false;
      hint.textContent = 'Este bot ya está vinculado a WhatsApp.';
    }
    return;
  }
  if (status.pairingReady === false) {
    button.disabled = true;
    if (hint) {
      hint.hidden = false;
      hint.textContent = 'La conexión está en modo vinculación: pide el código cuando aparezca el QR.';
    }
    return;
  }
  button.disabled = false;
  if (hint) {
    hint.hidden = true;
    hint.textContent = '';
  }
  if (status.pairingCode && status.pairingExpiresAt) {
    renderPairingCode(status.pairingCode, status.pairingExpiresAt);
  } else {
    if (box) box.hidden = true;
    if (countdown) countdown.hidden = true;
    if (error) error.hidden = true;
  }
}

async function requestPairingCode() {
  const button = document.getElementById('pair');
  const error = document.getElementById('pairError');
  const phone = document.getElementById('phone');
  if (error) {
    error.hidden = true;
    error.textContent = '';
  }
  if (button) button.disabled = true;
  try {
    const response = await fetch('/api/pair', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: phone ? phone.value : '' }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      if (error) {
        error.hidden = false;
        error.textContent = data.error || 'No se pudo pedir el código.';
      }
      const box = document.getElementById('pairCode');
      if (box) box.hidden = true;
      return;
    }
    const expiresAt = typeof data.expiresAt === 'string' ? new Date(data.expiresAt).getTime() : Number(data.expiresAt);
    const shown = renderPairingCode(data.code, expiresAt);
    if (!shown && error) {
      error.hidden = false;
      error.textContent = 'El código expiró antes de mostrarse. Inténtalo otra vez.';
    }
  } catch {
    if (error) {
      error.hidden = false;
      error.textContent = 'No se pudo contactar con el panel.';
    }
  } finally {
    if (button) button.disabled = false;
  }
}

/* ------------------------------- portada --------------------------------- */

async function renderHome() {
  const user = V.state.user;
  const platform = await V.loadPlatform();
  const greeting = document.getElementById('greeting');
  if (greeting) greeting.textContent = user ? `Hola, ${user.name}` : 'Hola, bienvenido';

  if (platform) {
    V.setText('statBots', V.num(platform.counts.totalBots));
    V.setText('statMain', V.num(platform.counts.main));
    V.setText('statPremium', V.num(platform.counts.premium));
    V.setText('statSubs', V.num(platform.counts.subs));
    V.setText('statUsers', V.num(platform.counts.users));
    V.setText('statCommands', V.num(platform.counts.implemented));
    V.setText('statCatalog', V.num(platform.counts.catalogBots));
    V.setText('platformVersion', `${platform.bot} ${platform.version}`);
    V.setText('platformServers', `${platform.servers.filter((server) => server.status === 'online').length}/${platform.servers.length}`);
    const mode = document.getElementById('platformMode');
    if (mode) mode.textContent = platform.memoryMode ? 'Modo memoria (sin base de datos)' : 'PostgreSQL conectado';
    const serverSelect = document.getElementById('serverList');
    if (serverSelect) {
      serverSelect.replaceChildren(
        ...platform.servers.map((server) =>
          V.el('div', { class: 'kv' }, [
            V.el('div', {}, [
              V.el('span', { text: server.name }),
              V.el('span', { class: server.status === 'online' ? 'pill green' : server.status === 'full' ? 'pill amber' : 'pill red', text: `${server.used}/${server.capacity}` }),
            ]),
          ]),
        ),
      );
    }
  }

  const connection = document.getElementById('connectionCard');
  if (connection) {
    try {
      const status = await fetch('/api/status', { credentials: 'same-origin' }).then((response) => response.json());
      V.setStatus(status.linked, status.linked ? 'WhatsApp en línea' : status.whatsapp === 'qr' ? 'Esperando vinculación' : 'Desconectado');
      V.setText('connState', status.linked ? 'En línea' : status.whatsapp === 'qr' ? 'Listo para vincular' : status.whatsapp);
      V.setText('connMe', status.me ?? 'Sin sesión');
      V.setText('connUptime', V.uptime(status.uptimeSec));
      const qr = document.getElementById('qrBox');
      if (qr) {
        if (status.qr) {
          qr.hidden = false;
          qr.innerHTML = `<img src="${status.qr}" alt="Código QR de WhatsApp" style="width:220px;border-radius:16px" />`;
        } else {
          qr.hidden = true;
          qr.innerHTML = '';
        }
      }
      renderPairingControls(status);
    } catch {
      V.setText('connState', 'Sin conexión');
    }
  }

  renderCollaborators();
  await renderEconomyWidget();
  await renderAuthArea();
}

const COLLABORATORS = [
  { name: 'Versova Team', role: 'CEO', emoji: 'V', href: '/links' },
  { name: 'Soporte 24/7', role: 'SOPORTE', emoji: 'S', href: '/ticket' },
  { name: 'Moderación', role: 'SOCIO', emoji: 'M', href: '/links#soporte' },
  { name: 'Comunidad', role: 'MODERADOR', emoji: 'C', href: '/links#canal' },
];

function renderCollaborators() {
  const box = document.getElementById('collabList');
  if (!box) return;
  box.replaceChildren(
    ...COLLABORATORS.map((person) =>
      V.el('a', { class: 'collab', href: person.href }, [
        V.el('span', { class: 'av', text: person.emoji }),
        V.el('span', {}, [
          V.el('b', { text: person.name }),
          V.el('div', { class: 'tiny muted', text: person.role }),
        ]),
      ]),
    ),
  );
}

const LINKS = [
  { ico: '📣', title: 'Canal de WhatsApp', text: 'Avisos sobre futuras actualizaciones', href: '/links#canal' },
  { ico: '💬', title: 'Grupo de soporte', text: 'Ayuda directa del equipo', href: '/links#soporte' },
  { ico: '🎛️', title: 'Mis Bots', text: 'Administra tus sesiones activas', href: '/bots' },
  { ico: '🧩', title: 'Catálogo de bots', text: 'Bots gratis y de pago', href: '/store#catalogo' },
  { ico: '⌘', title: 'Comandos', text: 'Catálogo completo con categorías', href: '/cmds' },
  { ico: '📈', title: 'Estado del sistema', text: 'Telemetría y servidores en vivo', href: '/metrics' },
  { ico: '🪙', title: 'Economía', text: 'Monedas, misiones y tienda interna', href: '/store' },
  { ico: '🎫', title: 'Reportes', text: 'Reporta un bug o sugiere una idea', href: '/ticket' },
];

function renderLinks() {
  const box = document.getElementById('linksList');
  if (!box) return;
  box.replaceChildren(
    ...LINKS.map((link) =>
      V.el('a', { class: 'menu-item', href: link.href }, [
        V.el('span', { class: 'ico', text: link.ico }),
        V.el('span', { class: 'grow' }, [V.el('b', { text: link.title }), V.el('span', { text: link.text })]),
        V.el('span', { class: 'muted', text: '›' }),
      ]),
    ),
  );
}

function renderMenuPage() {
  const box = document.getElementById('menuGrid');
  if (!box) return;
  box.replaceChildren(
    ...V.MENU.map((item) =>
      V.el('a', { class: 'menu-item', href: item.href }, [
        V.el('span', { class: 'ico', text: item.ico }),
        V.el('span', { class: 'grow' }, [V.el('b', { text: item.title }), V.el('span', { text: item.text })]),
        V.el('span', { class: 'muted', text: '›' }),
      ]),
    ),
  );
}

async function renderEconomyWidget() {
  const box = document.getElementById('economyWidget');
  if (!box || !V.state.user) return;
  try {
    const economy = await V.api('/api/economy');
    APP.economy = economy;
    box.replaceChildren(
      V.el('div', { class: 'row-between' }, [
        V.el('div', {}, [
          V.el('span', { class: 'label', text: 'Tu monedero' }),
          V.el('h2', { text: `${V.num(economy.coins)} ${economy.coin.name}` }),
          V.el('p', { class: 'small muted', text: `Monedas para el catálogo de bots y la tienda interna.` }),
        ]),
        V.el('span', { class: 'hero-avatar', style: 'width:64px;height:64px;font-size:26px', text: '🪙' }),
      ]),
      V.el('div', { class: 'row', style: 'margin-top:14px;flex-wrap:wrap' }, [
        V.el('button', {
          class: `btn btn-sm ${economy.daily.available ? 'btn-primary' : ''}`,
          type: 'button',
          text: economy.daily.available ? `Reclamar bono diario (+${economy.daily.reward})` : 'Bono diario reclamado',
          disabled: !economy.daily.available,
          onclick: async (event) => {
            try {
              const result = await V.api('/api/economy/daily', { body: {} });
              V.toast('Bono reclamado', `+${result.reward} ${economy.coin.name} · saldo ${V.num(result.coins)}`, 'ok');
              await renderEconomyWidget();
            } catch (error) {
              V.toast('No se pudo reclamar', error.message, 'err');
            }
          },
        }),
        V.el('a', { class: 'btn btn-sm btn-ghost', href: '/store', text: 'Ir a la tienda' }),
        V.el('a', { class: 'btn btn-sm btn-ghost', href: '/store#catalogo', text: 'Catálogo de bots' }),
      ]),
      V.el('div', { class: 'grid grid-3', style: 'margin-top:14px' },
        economy.missions.map((mission) =>
          V.el('div', { class: 'card card-soft card-pad-sm' }, [
            V.el('div', { class: 'row-between' }, [
              V.el('b', { class: 'small', text: mission.name }),
              V.el('span', { class: `pill ${mission.claimed ? 'green' : mission.ready ? 'accent' : 'amber'}`, text: mission.claimed ? 'Cobrada' : mission.ready ? `+${mission.reward}` : 'Pendiente' }),
            ]),
            V.el('p', { class: 'tiny muted', style: 'margin:6px 0 8px', text: mission.description }),
            mission.claimed
              ? V.el('span', { class: 'tiny muted', text: 'Misión completada' })
              : V.el('button', {
                  class: 'btn btn-sm btn-block',
                  type: 'button',
                  text: `Reclamar ${mission.reward} 🪙`,
                  disabled: !mission.ready && mission.id !== 'daily',
                  onclick: async () => {
                    try {
                      const path = mission.id === 'daily' ? '/api/economy/daily' : '/api/economy/mission';
                      const body = mission.id === 'daily' ? {} : { missionId: mission.id };
                      const result = await V.api(path, { body });
                      V.toast('Recompensa cobrada', `+${result.reward} ${economy.coin.name}`, 'ok');
                      await renderEconomyWidget();
                    } catch (error) {
                      V.toast('No se pudo cobrar', error.message, 'err');
                    }
                  },
                }),
          ]),
        ),
      ),
    );
  } catch (error) {
    box.replaceChildren(V.note(`No se pudo cargar tu economía: ${error.message}`, 'warn'));
  }
}

async function renderAuthArea() {
  const area = document.getElementById('authArea');
  if (!area) return;
  const googleArea = document.getElementById('googleArea');
  if (googleArea && !googleArea.childElementCount && !V.state.user) {
    const button = V.googleButton();
    if (button) googleArea.replaceChildren(button);
  }
  if (V.state.user) {
    area.replaceChildren(
      V.el('span', { class: 'pill accent', text: `${V.num(V.state.user.coins)} 🪙` }),
      V.el('span', { class: 'pill', text: V.state.user.planInfo?.name ?? V.state.user.plan }),
    );
    return;
  }
  area.replaceChildren(V.el('a', { class: 'btn btn-sm btn-primary', href: '/?login=1', text: 'Iniciar sesión' }));
}

/* --------------------------- autenticación (modal) ------------------------ */

function openAuth(mode = 'login') {
  const modal = document.getElementById('authModal');
  if (!modal) return;
  modal.classList.add('is-open');
  setAuthMode(mode);
}

function closeAuth() {
  const modal = document.getElementById('authModal');
  if (modal) modal.classList.remove('is-open');
  const url = new URL(window.location.href);
  if (url.searchParams.has('login')) {
    url.searchParams.delete('login');
    window.history.replaceState({}, '', url.toString());
  }
}

function setAuthMode(mode) {
  const isLogin = mode === 'login';
  const title = document.getElementById('authTitle');
  const submit = document.getElementById('authSubmit');
  const switchText = document.getElementById('authSwitch');
  const nameField = document.getElementById('authNameField');
  if (title) title.textContent = isLogin ? 'Inicia sesión' : 'Crea tu cuenta';
  if (submit) submit.textContent = isLogin ? 'Entrar' : 'Crear cuenta';
  if (switchText) switchText.textContent = isLogin ? '¿No tienes cuenta? Regístrate' : '¿Ya tienes cuenta? Inicia sesión';
  if (nameField) nameField.hidden = isLogin;
  const modal = document.getElementById('authModal');
  if (modal) modal.dataset.mode = mode;
  const error = document.getElementById('authError');
  if (error) error.hidden = true;
}

async function submitAuth(event) {
  event?.preventDefault?.();
  const modal = document.getElementById('authModal');
  const mode = modal?.dataset.mode === 'register' ? 'register' : 'login';
  const email = document.getElementById('authEmail')?.value ?? '';
  const password = document.getElementById('authPassword')?.value ?? '';
  const name = document.getElementById('authName')?.value ?? '';
  const error = document.getElementById('authError');
  try {
    await V.api(`/api/auth/${mode}`, { body: { email, password, name } });
    V.toast('Bienvenido', 'Sesión iniciada correctamente.', 'ok');
    const next = new URLSearchParams(window.location.search).get('next');
    window.location.href = next === 'store' ? '/store' : next === 'bots' ? '/bots' : next === 'registrar' ? '/registrar' : '/';
  } catch (err) {
    if (error) {
      error.hidden = false;
      error.textContent = err.message;
    }
  }
}

/* ============================== ASISTENTE ================================= */

const WIZARD_STEPS = ['Instancia', 'Servidor', 'Vinculación', 'Nombre', 'Código'];

function renderSteps() {
  const box = document.getElementById('wizardSteps');
  if (!box) return;
  const nodes = [];
  WIZARD_STEPS.forEach((label, index) => {
    if (index > 0) nodes.push(V.el('i', { class: `step-line ${index <= APP.wizardStep ? 'is-done' : ''}` }));
    const state = index < APP.wizardStep ? 'is-done' : index === APP.wizardStep ? 'is-active' : '';
    nodes.push(V.el('div', { class: `step ${state}`, title: label, text: index < APP.wizardStep ? '✓' : String(index + 1) }));
  });
  box.replaceChildren(...nodes);
}

function showWizardStep(step) {
  APP.wizardStep = Math.max(0, Math.min(WIZARD_STEPS.length - 1, step));
  if (APP.wizardStep !== 4) {
    stopWizardPolling();
    APP.wizardRun += 1;
  }
  renderSteps();
  for (let index = 0; index < WIZARD_STEPS.length; index += 1) {
    const panel = document.getElementById(`step${index}`);
    if (panel) panel.hidden = index !== APP.wizardStep;
  }
  const pill = document.getElementById('pasoPill');
  if (pill) pill.textContent = `Paso ${APP.wizardStep + 1} de 5`;
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function renderRegistrar() {
  const user = await V.ensureSession();
  if (!user) return;
  const [servers, subbots] = await Promise.all([
    V.api('/api/servers').catch(() => ({ servers: [] })),
    V.api('/api/subbots').catch(() => ({ bots: [], tokens: [], usage: {} })),
  ]);
  APP.servers = servers.servers ?? [];
  APP.subbotsMeta = subbots;
  APP.subbots = subbots.bots ?? [];

  const used = subbots.usage?.botsUsed ?? APP.subbots.length;
  const max = subbots.usage?.botsMax ?? 3;
  const limitNote = document.getElementById('wizardLimit');
  if (limitNote) {
    limitNote.textContent = `Plan ${subbots.plan?.name ?? user.plan} · ${used}/${max} bots · ${V.num(user.coins)} 🪙 disponibles`;
  }

  // Paso 1 · instancias
  const instances = subbots.instances ?? [];
  const instanceBox = document.getElementById('instanceOptions');
  if (instanceBox) {
    instanceBox.replaceChildren(
      ...instances.map((instance) =>
        V.el('button', {
          class: `select-card ${APP.selectedInstance === instance.id ? 'is-active' : ''}`,
          type: 'button',
          onclick: () => {
            APP.selectedInstance = instance.id;
            APP.wizard.instance = instance.id;
            renderRegistrarInstance(instances);
          },
        }, [
          V.el('span', { class: 'ico', text: instance.emoji }),
          V.el('span', { class: 'grow' }, [
            V.el('b', { text: instance.name }),
            V.el('small', { text: instance.description }),
          ]),
          V.el('span', { class: 'check', text: APP.selectedInstance === instance.id ? '✓' : '' }),
        ]),
      ),
    );
    renderRegistrarInstance(instances);
  }

  // Paso 1 · tokens si la instancia los pide
  const tokens = subbots.tokens ?? [];
  const tokenField = document.getElementById('tokenField');
  if (tokenField) tokenField.hidden = true;
  const tokenSelect = document.getElementById('tokenSelect');
  if (tokenSelect) {
    tokenSelect.replaceChildren(
      V.el('option', { value: '', text: tokens.length ? 'Elige un token…' : 'No tienes tokens disponibles' }),
      ...tokens.map((token) => V.el('option', { value: token.code, text: `${token.code} · ${token.type.toUpperCase()} · ${token.space_gb} GB` })),
    );
  }

  // Paso 2 · servidores
  const serverSelect = document.getElementById('serverSelect');
  if (serverSelect) {
    serverSelect.replaceChildren(
      ...APP.servers.map((server) =>
        V.el('option', {
          value: server.id,
          disabled: server.full || server.status === 'maintenance',
          text: `${server.name} (${server.used}/${server.capacity})${server.status === 'maintenance' ? ' · mantenimiento' : server.full ? ' · lleno' : ''}`,
        }),
      ),
    );
    serverSelect.value = APP.selectedServer;
    serverSelect.addEventListener('change', () => {
      APP.selectedServer = serverSelect.value;
      const server = APP.servers.find((entry) => entry.id === serverSelect.value);
      APP.wizard.serverId = serverSelect.value;
      APP.wizard.serverName = server?.name ?? '';
      V.setText('serverHint', server ? `Región ${server.region} · ${server.free} cupos libres · CPU ${server.cpu}%` : 'Se muestran cupos disponibles y servidores llenos deshabilitados.');
    });
    const current = APP.servers.find((entry) => entry.id === APP.selectedServer);
    V.setText('serverHint', current ? `Región ${current.region} · ${current.free} cupos libres · CPU ${current.cpu}%` : 'Se muestran cupos disponibles y servidores llenos deshabilitados.');
  }

  // Paso 3 · vinculación
  const methodBox = document.getElementById('methodOptions');
  if (methodBox) {
    methodBox.replaceChildren(
      ...[
        { id: 'qr', ico: '▦', name: 'Código QR', text: 'Escaneas un código desde el dispositivo del bot.' },
        { id: 'code', ico: '#', name: 'Código de 8 dígitos', text: 'Lo escribes en el dispositivo del bot.' },
      ].map((method) =>
        V.el('button', {
          class: `select-card ${APP.wizard.method === method.id ? 'is-active' : ''}`,
          type: 'button',
          onclick: () => {
            APP.wizard.method = method.id;
            renderRegistrar();
          },
        }, [
          V.el('span', { class: 'ico', text: method.ico }),
          V.el('span', { class: 'grow' }, [V.el('b', { text: method.name }), V.el('small', { text: method.text })]),
          V.el('span', { class: 'check', text: APP.wizard.method === method.id ? '✓' : '' }),
        ]),
      ),
    );
  }

  showWizardStep(APP.wizardStep);
}

function renderRegistrarInstance(instances) {
  const instance = instances.find((entry) => entry.id === APP.selectedInstance);
  const field = document.getElementById('tokenField');
  if (field) field.hidden = !instance?.requiresToken;
  V.setText('instanceHint', instance?.requiresToken
    ? 'Esta instancia necesita un token. Cómpralo en la tienda o gánalo con las misiones.'
    : 'Instancia gratuita: se crea al instante sin token.');
}

async function createBotFromWizard() {
  const name = document.getElementById('botName')?.value?.trim() ?? '';
  const phone = document.getElementById('wizardPhone')?.value?.trim() ?? '';
  const tokenCode = document.getElementById('tokenSelect')?.value ?? '';
  const instance = (APP.subbotsMeta?.instances ?? []).find((entry) => entry.id === APP.selectedInstance);
  const server = APP.servers.find((entry) => entry.id === APP.selectedServer);

  if (name.length < 2) {
    V.toast('Falta el nombre', 'Escribe un nombre de al menos 2 caracteres.', 'err');
    showWizardStep(3);
    return;
  }
  if (instance?.requiresToken && !tokenCode) {
    V.toast('Token requerido', 'Elige el token de la instancia que quieres activar.', 'err');
    showWizardStep(0);
    return;
  }

  const tier = instance?.requiresToken ? (APP.selectedInstance === 'vip' ? 'vip' : 'premium') : 'free';
  const body = {
    name,
    tier,
    phone,
    tokenCode,
    instanceType: APP.selectedInstance,
    serverId: APP.selectedServer,
    serverName: server?.name ?? '',
    botType: 'versova',
    catalogSlug: 'versova',
    shortName: name,
    longName: name,
    description: `Bot creado desde el asistente (${instance?.name ?? 'SubBot'}).`,
    username: name.toLowerCase().replace(/[^a-z0-9]/g, ''),
    prefixes: ['/'],
  };

  try {
    const result = await V.api('/api/subbots', { body });
    APP.wizard.botId = result.bot.id;
    APP.wizard.name = name;
    APP.wizard.phone = phone;
    V.toast('Bot creado', `«${name}» está listo para vincularse.`, 'ok');
    await showPairingStep();
  } catch (error) {
    V.toast('No se pudo crear el bot', error.message, 'err');
  }
}

/* El QR y el estado de WhatsApp vienen de la misma conexión que usa la consola (/api/status). */
const WIZARD_WAIT_MS = 2000;
const WIZARD_WAIT_TRIES = 30;

function stopWizardPolling() {
  clearInterval(APP.wizardPoll);
  APP.wizardPoll = null;
}

function wizardSleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWhatsappStatus() {
  const response = await fetch('/api/status', { credentials: 'same-origin' });
  return response.json();
}

/** Muestra el QR real de WhatsApp y lo renueva mientras el paso está abierto. */
function startWizardQrPolling() {
  stopWizardPolling();
  let lastQr = null;
  const tick = async () => {
    if (APP.wizard.method !== 'qr' || APP.wizardStep !== 4) return stopWizardPolling();
    const qrBox = document.getElementById('wizardQr');
    try {
      const status = await fetchWhatsappStatus();
      if (!qrBox) return;
      qrBox.hidden = false;
      if (status.linked) {
        lastQr = null;
        qrBox.replaceChildren(V.el('div', { class: 'pill green', text: 'WhatsApp ya está en línea. Pulsa «Ya lo vinculé».' }));
      } else if (status.qr) {
        if (status.qr !== lastQr) {
          lastQr = status.qr;
          qrBox.replaceChildren(
            V.el('div', { class: 'center' }, [
              V.el('img', { src: status.qr, alt: 'Código QR de WhatsApp', style: 'width:220px;border-radius:16px' }),
              V.el('div', { class: 'mono tiny muted', style: 'margin-top:10px', text: 'WhatsApp › Dispositivos vinculados › Vincular dispositivo' }),
            ]),
          );
        }
      } else {
        lastQr = null;
        qrBox.replaceChildren(V.el('p', { class: 'muted small', text: 'Preparando el QR de WhatsApp…' }));
      }
    } catch {
      /* se reintenta en el siguiente tick */
    }
  };
  tick();
  APP.wizardPoll = setInterval(tick, WIZARD_WAIT_MS);
}

/** Espera a que WhatsApp esté en modo vinculación (QR listo) antes de pedir el código. */
async function waitForWhatsappReady(run) {
  const countdown = document.getElementById('wizardCountdown');
  for (let attempt = 0; attempt < WIZARD_WAIT_TRIES; attempt += 1) {
    if (run !== APP.wizardRun) return null;
    const status = await fetchWhatsappStatus();
    if (status.linked) throw new Error('Este bot ya está vinculado a WhatsApp. Cierra sesión antes de vincular otro número.');
    if (status.pairingReady) return status;
    if (countdown) {
      countdown.hidden = false;
      countdown.textContent = 'PREPARANDO WHATSAPP…';
    }
    await wizardSleep(WIZARD_WAIT_MS);
  }
  throw new Error('WhatsApp tardó demasiado en quedar listo para vincular. Pulsa «Generar otro» para intentarlo de nuevo.');
}

async function showPairingStep() {
  showWizardStep(4);
  const run = (APP.wizardRun = (APP.wizardRun ?? 0) + 1);
  const box = document.getElementById('wizardCode');
  const error = document.getElementById('wizardError');
  const countdown = document.getElementById('wizardCountdown');
  const confirm = document.getElementById('wizardConfirm');
  const qrBox = document.getElementById('wizardQr');
  const method = APP.wizard.method;
  stopWizardPolling();
  clearInterval(APP.pairing.timer);
  if (error) error.hidden = true;
  if (countdown) countdown.hidden = true;
  if (confirm) confirm.hidden = false;
  if (box) box.replaceChildren();
  if (qrBox) {
    qrBox.hidden = method !== 'qr';
    qrBox.replaceChildren();
  }
  V.setText('wizardStepTitle', method === 'code' ? 'Ingresa el código' : 'Escanea el código');
  V.setText(
    'wizardStepText',
    method === 'code'
      ? 'Desde el teléfono que va a ser el bot, abre WhatsApp y escribe este código.'
      : 'Desde el teléfono que va a ser el bot, abre WhatsApp y escanea este código.',
  );

  if (method === 'qr') {
    startWizardQrPolling();
    return;
  }

  try {
    await waitForWhatsappReady(run);
    if (run !== APP.wizardRun) return;
    // El servidor pide el código a WhatsApp; solo se muestra si WhatsApp lo aceptó.
    const pairing = await V.api(`/api/subbots/${APP.wizard.botId}/pair`, { body: { phone: APP.wizard.phone } });
    if (run !== APP.wizardRun) return;
    if (box) {
      box.replaceChildren(
        ...String(pairing.code).split('').map((char) => (char === '-' ? V.el('span', { class: 'code-sep', text: '–' }) : V.el('span', { class: 'code-char', text: char }))),
      );
    }
    if (countdown) {
      let left = Math.max(0, Math.round((pairing.expiresAt - Date.now()) / 1000));
      countdown.hidden = false;
      const paint = () => {
        countdown.textContent = `EXPIRA EN ${left}S`;
        left -= 1;
        if (left < -1) {
          clearInterval(APP.pairing.timer);
          countdown.hidden = true;
          if (box) box.replaceChildren();
          if (error) {
            error.hidden = false;
            error.textContent = 'El código expiró. Pulsa «Generar otro» para pedir uno nuevo.';
          }
        }
      };
      clearInterval(APP.pairing.timer);
      paint();
      APP.pairing.timer = setInterval(paint, 1000);
    }
  } catch (err) {
    if (run !== APP.wizardRun) return;
    if (error) {
      error.hidden = false;
      error.textContent = err.message;
    }
    if (countdown) countdown.hidden = true;
  }
}

async function confirmPairing() {
  try {
    const result = await V.api(`/api/subbots/${APP.wizard.botId}/pair/confirm`, { body: {} });
    clearInterval(APP.pairing.timer);
    stopWizardPolling();
    V.toast('¡Listo!', 'Tu bot ya está en línea.', 'ok');
    const success = document.getElementById('wizardSuccess');
    if (success) {
      success.hidden = false;
      success.replaceChildren(
        V.el('h3', { text: '¡Listo!' }),
        V.el('h2', { class: 'gradient-text', text: 'Tu bot ya está en línea' }),
        V.el('p', { class: 'muted small', text: `Escríbele ${(result.bot?.prefixes ?? ['/'])[0]}menu en un grupo para ver todo lo que puede hacer.` }),
        V.el('div', { class: 'kv', style: 'margin-top:12px' }, [
          V.el('div', {}, [V.el('span', { text: 'Número' }), V.el('span', { class: 'mono', text: result.bot?.phone || APP.wizard.phone || '—' })]),
          V.el('div', {}, [V.el('span', { text: 'Nombre' }), V.el('span', { text: result.bot?.name ?? APP.wizard.name })]),
          V.el('div', {}, [V.el('span', { text: 'Prefijo' }), V.el('span', { class: 'mono', text: (result.bot?.prefixes ?? ['/']).join(' ') })]),
          V.el('div', {}, [V.el('span', { text: 'Owner' }), V.el('span', { text: result.bot?.owner_number || 'Sin asignar' })]),
        ]),
        V.el('div', { class: 'row', style: 'margin-top:14px' }, [
          V.el('a', { class: 'btn btn-primary', href: '/bots', text: 'Ir a Mis Bots' }),
          V.el('a', { class: 'btn btn-ghost', href: '/registrar', text: 'Crear otro' }),
        ]),
      );
    }
    showWizardStep(4);
    const confirmButton = document.getElementById('wizardConfirm');
    if (confirmButton) confirmButton.hidden = true;
    const countdown = document.getElementById('wizardCountdown');
    if (countdown) countdown.hidden = true;
  } catch (error) {
    V.toast('No se pudo vincular', error.message, 'err');
  }
}

/* ============================== MIS BOTS ================================== */

function botStatusPill(bot) {
  if (bot.status === 'online') return V.el('span', { class: 'pill green' }, [V.el('i', { class: 'dot live' }), 'ONLINE']);
  if (bot.status === 'paused') return V.el('span', { class: 'pill amber' }, [V.el('i', { class: 'dot warn' }), 'PAUSA']);
  return V.el('span', { class: 'pill red' }, [V.el('i', { class: 'dot off' }), 'OFFLINE']);
}

async function renderBots() {
  const user = await V.ensureSession();
  if (!user) return;
  const data = await V.api('/api/subbots');
  APP.subbots = data.bots ?? [];
  APP.subbotsMeta = data;
  V.setText('botsCount', String(APP.subbots.length));
  V.setText('botsPlan', `Plan ${data.plan?.name ?? user.plan} · ${data.usage.botsUsed}/${data.usage.botsMax} bots · ${V.num(user.coins)} 🪙`);

  const list = document.getElementById('botsList');
  if (!list) return;
  if (!APP.subbots.length) {
    list.replaceChildren(
      V.el('div', { class: 'center', style: 'padding:26px 10px' }, [
        V.el('p', { class: 'muted', text: 'No tienes bots registrados aún.' }),
        V.el('a', { class: 'btn btn-primary', href: '/registrar', text: 'Crear bot' }),
      ]),
    );
    return;
  }

  list.replaceChildren(
    ...APP.subbots.map((bot) => {
      const groups = bot.groups?.filter((group) => group.active) ?? [];
      const prefix = (bot.prefixes ?? ['.'])[0] ?? '.';
      return V.el('div', { class: 'bot-card', id: `bot-${bot.id}` }, [
        V.el('div', { class: 'bot-head' }, [
          bot.avatar_url
            ? V.el('img', { class: 'bot-avatar', src: bot.avatar_url, alt: bot.name })
            : V.el('span', { class: 'bot-avatar', text: '🐺' }),
          V.el('div', { class: 'grow' }, [
            V.el('div', { class: 'row-between' }, [
              V.el('div', {}, [
                V.el('div', { class: 'bot-name', text: bot.name }),
                V.el('div', { class: 'bot-phone', text: bot.phone || 'sin número' }),
              ]),
              bot.status === 'online'
                ? V.el('button', { class: 'icon-btn', type: 'button', title: 'Reiniciar', text: '⚠️', onclick: () => botAction(bot.id, 'restart') })
                : null,
            ]),
            V.el('span', { class: 'uptime', text: `⬤ ${V.uptime(bot.uptime_seconds)}` }),
          ]),
        ]),
        V.el('div', { class: 'chips' }, [
          V.el('span', { class: 'pill accent', text: (bot.instance_type || 'subbot').toUpperCase() }),
          V.el('span', { class: 'pill amber', text: bot.linked_at ? 'Código' : 'Sin vincular' }),
          botStatusPill(bot),
          V.el('span', { class: 'pill', text: bot.server_name || bot.server_id }),
          V.el('span', { class: 'pill green', text: `↻ ${bot.extra_gb}/${bot.totalSpaceGb} GB` }),
          V.el('span', { class: 'pill', text: `prefijo ${prefix}` }),
          V.el('span', { class: 'pill', text: `${groups.length} grupos` }),
        ]),
        V.el('div', { class: 'bot-actions' }, [
          botActionButton('⚙', 'Config', () => openBotOptions(bot.id)),
          botActionButton('👥', 'Grupos', () => openBotGroups(bot.id)),
          botActionButton(bot.status === 'offline' ? '⏻' : '⭘', bot.status === 'offline' ? 'Encender' : 'Apagar', () => botAction(bot.id, bot.status === 'offline' ? 'start' : 'stop')),
          botActionButton('↻', 'Reiniciar', () => botAction(bot.id, 'restart')),
          botActionButton('🌐', 'Server', () => openBotServer(bot.id)),
          botActionButton('🗑', 'Borrar', () => botAction(bot.id, 'delete'), true),
        ]),
      ]);
    }),
  );
}

function botActionButton(ico, label, onclick, danger = false) {
  return V.el('button', { class: `bot-action${danger ? ' danger' : ''}`, type: 'button', onclick }, [
    V.el('span', { class: 'ico', text: ico }),
    V.el('span', { text: label }),
  ]);
}

async function botAction(id, action) {
  const bot = APP.subbots.find((entry) => entry.id === id);
  if (action === 'delete') {
    if (!V.confirmDialog('Borrar bot', `¿Seguro que quieres borrar «${bot?.name ?? 'este bot'}»? Esta acción no se puede deshacer.`)) return;
  }
  try {
    const result = await V.api(`/api/subbots/${id}/action`, { body: { action } });
    if (result.message) V.toast('Listo', result.message, 'ok');
    await renderBots();
  } catch (error) {
    V.toast('No se pudo completar', error.message, 'err');
  }
}

/* --------------------------- opciones del bot ---------------------------- */

let editingBotId = null;

async function openBotOptions(id) {
  const bot = APP.subbots.find((entry) => entry.id === id);
  if (!bot) return;
  editingBotId = id;
  const modal = document.getElementById('botModal');
  const catalog = APP.subbotsMeta?.catalog ?? [];
  if (!modal) return;

  V.setText('botModalTitle', 'Opciones del bot');
  V.setText('botModalSub', `ID ····${String(bot.id).slice(-4)} · ${(bot.instance_type || 'subbot').toUpperCase()} · ${(bot.server_name || bot.server_id).toUpperCase()}`);

  const set = (id, value) => {
    const node = document.getElementById(id);
    if (node) node.value = value ?? '';
  };
  set('optShortName', bot.short_name);
  set('optLongName', bot.long_name);
  set('optCurrency', bot.currency);
  V.setText('optOwnerValue', bot.owner_hidden ? 'Oculto por privacidad' : bot.owner_number || '—');
  set('optBotLink', bot.bot_link);
  set('optChannel', bot.channel_url);
  set('optBanner', bot.banner_url);
  set('optUsername', bot.username);
  set('optStatus', bot.status_info || 'online');
  V.setText('optSync', `Sync: ${V.dateTime(bot.synced_at || bot.updated_at)}`);

  const prefixes = bot.prefixes?.length ? bot.prefixes : ['.'];
  renderPrefixPicker(prefixes);

  const catalogSelect = document.getElementById('optCatalog');
  if (catalogSelect) {
    catalogSelect.replaceChildren(
      ...catalog.map((entry) => V.el('option', { value: entry.slug, text: `${entry.emoji} ${entry.name} · ${entry.pricing === 'free' ? 'gratis' : entry.pricing === 'coins' ? `${entry.priceCoins} 🪙` : `$${Number(entry.price_usd).toFixed(2)}`}` })),
    );
    catalogSelect.value = bot.catalog_slug || 'versova';
  }

  const ownerToggle = document.getElementById('optOwnerToggle');
  if (ownerToggle) {
    ownerToggle.textContent = bot.owner_hidden ? '👁 Oculto' : '👁 Visible';
    ownerToggle.onclick = () => {
      const current = V.$('optOwnerHidden');
      const hidden = current ? current.value !== '1' : true;
      if (V.$('optOwnerHidden')) V.$('optOwnerHidden').value = hidden ? '0' : '1';
      V.setText('optOwnerValue', hidden ? '—' : bot.owner_number || '—');
      ownerToggle.textContent = hidden ? '👁 Visible' : '👁 Oculto';
    };
  }
  const hiddenInput = document.getElementById('optOwnerHidden');
  if (hiddenInput) hiddenInput.value = bot.owner_hidden ? '1' : '0';

  V.openModal('botModal');
}

function renderPrefixPicker(selected) {
  const box = document.getElementById('optPrefixes');
  const chipsBox = document.getElementById('optPrefixChips');
  const choices = ['/', '#', '!', '+', '-', '.', '*', '~'];
  let current = [...selected];
  const paint = () => {
    if (box) {
      box.replaceChildren(
        ...choices.map((choice) =>
          V.el('button', {
            class: `chip ${current.includes(choice) ? 'is-active' : ''}`,
            type: 'button',
            text: choice,
            onclick: () => {
              current = current.includes(choice) ? current.filter((item) => item !== choice) : [...current, choice];
              paint();
            },
          }),
        ),
      );
    }
    if (chipsBox) {
      chipsBox.replaceChildren(
        ...(current.length
          ? current.map((choice) =>
              V.el('span', { class: 'pill accent', text: `${choice} ✕`, onclick: () => { current = current.filter((item) => item !== choice); paint(); } }),
            )
          : [V.el('span', { class: 'pill', text: 'SIN PREFIJO' })]),
      );
    }
  };
  paint();
  return () => current;
}

async function saveBotOptions() {
  if (!editingBotId) return;
  const body = {
    shortName: document.getElementById('optShortName')?.value ?? '',
    longName: document.getElementById('optLongName')?.value ?? '',
    currency: document.getElementById('optCurrency')?.value ?? '',
    ownerNumber: document.getElementById('optOwnerValue')?.textContent?.includes('Oculto') ? (APP.subbots.find((bot) => bot.id === editingBotId)?.owner_number ?? '') : (document.getElementById('optOwnerValue')?.textContent ?? ''),
    ownerHidden: document.getElementById('optOwnerHidden')?.value !== '0',
    botLink: document.getElementById('optBotLink')?.value ?? '',
    channelUrl: document.getElementById('optChannel')?.value ?? '',
    bannerUrl: document.getElementById('optBanner')?.value ?? '',
    username: document.getElementById('optUsername')?.value ?? '',
    statusInfo: document.getElementById('optStatus')?.value ?? '',
    catalogSlug: document.getElementById('optCatalog')?.value ?? 'versova',
    prefixes: [...document.querySelectorAll('#optPrefixes .chip.is-active')].map((chip) => chip.textContent),
  };
  if (!body.prefixes.length) body.prefixes = ['.'];
  try {
    await V.api(`/api/subbots/${editingBotId}/options`, { method: 'PUT', body });
    V.toast('Guardado', 'Las opciones del bot se actualizaron.', 'ok');
    V.closeModal('botModal');
    await renderBots();
  } catch (error) {
    V.toast('No se pudo guardar', error.message, 'err');
  }
}

async function openBotGroups(id) {
  try {
    const data = await V.api(`/api/subbots/${id}/groups`);
    const list = document.getElementById('groupsList');
    const modal = document.getElementById('groupsModal');
    if (!list || !modal) return;
    list.replaceChildren(
      ...(data.groups.length
        ? data.groups.map((group) =>
            V.el('div', { class: 'kv' }, [
              V.el('div', {}, [
                V.el('span', { text: group.name }),
                V.el('span', { class: 'pill', text: `${group.members} 👥` }),
              ]),
            ]),
          )
        : [V.note('Este bot todavía no está en ningún grupo. Añádelo desde WhatsApp con el enlace del bot.')]),
    );
    V.openModal('groupsModal');
  } catch (error) {
    V.toast('No se pudieron leer los grupos', error.message, 'err');
  }
}

async function openBotServer(id) {
  try {
    const data = await V.api(`/api/subbots/${id}/action`, { body: { action: 'server' } });
    const list = document.getElementById('serverPickList');
    const modal = document.getElementById('serverModal');
    if (!list || !modal) return;
    list.replaceChildren(
      ...data.servers.map((server) =>
        V.el('button', {
          class: `select-card ${server.id === data.current ? 'is-active' : ''}`,
          type: 'button',
          onclick: async () => {
            try {
              await V.api(`/api/subbots/${id}/options`, { method: 'PUT', body: { serverId: server.id } });
              V.toast('Servidor cambiado', `${server.name}`, 'ok');
              V.closeModal('serverModal');
              await renderBots();
            } catch (error) {
              V.toast('No se pudo cambiar', error.message, 'err');
            }
          },
        }, [
          V.el('span', { class: 'ico', text: '🌐' }),
          V.el('span', { class: 'grow' }, [
            V.el('b', { text: server.name }),
            V.el('small', { text: `${server.region} · ${server.used}/${server.capacity} · CPU ${server.cpu}%` }),
          ]),
          V.el('span', { class: 'pill', text: server.status }),
        ]),
      ),
    );
    V.openModal('serverModal');
  } catch (error) {
    V.toast('No se pudo abrir los servidores', error.message, 'err');
  }
}

/* ================================ TIENDA ================================= */

async function renderStore() {
  const user = await V.ensureSession();
  if (!user) return;
  const [store, catalog, economy] = await Promise.all([
    V.api('/api/store/catalog'),
    V.api('/api/catalog'),
    V.api('/api/economy'),
  ]);
  APP.catalog = catalog;
  APP.economy = economy;
  V.setText('storeCoins', `${V.num(economy.coins)} ${economy.coin.name}`);
  V.setText('storePlan', `${store.plan?.name ?? user.plan} · ${store.usage.botsUsed}/${store.usage.botsMax} bots · ${store.usage.extraSpaceFree} GB libres`);

  // Packs de monedas y productos de pago (USD)
  const items = store.items ?? [];
  const usd = document.getElementById('storeItems');
  if (usd) {
    usd.replaceChildren(
      ...items.map((item) =>
        V.el('div', { class: 'card catalog-card' }, [
          V.el('div', { class: 'catalog-top' }, [
            V.el('span', { class: 'catalog-emoji', text: item.kind === 'token' ? '🎟️' : item.kind === 'space' ? '💾' : item.kind === 'plan' ? '👑' : item.kind === 'coins' ? '🪙' : '🧩' }),
            V.el('div', { class: 'grow' }, [
              V.el('div', { class: 'row-between' }, [
                V.el('b', { text: item.name }),
                V.el('span', { class: 'price-tag usd', text: `$${Number(item.priceUsd).toFixed(2)}` }),
              ]),
              V.el('p', { class: 'small muted', style: 'margin:6px 0 0', text: item.description }),
            ]),
          ]),
          V.el('div', { class: 'row-between' }, [
            item.badge ? V.el('span', { class: 'pill accent', text: item.badge }) : V.el('span', {}),
            V.el('button', {
              class: 'btn btn-sm btn-primary',
              type: 'button',
              text: 'Comprar',
              disabled: !item.available,
              onclick: async () => {
                try {
                  const result = await V.api('/api/store/checkout', { body: { itemId: item.id, quantity: 1 } });
                  V.toast('Compra realizada', result.receipt?.message ?? 'Listo.', 'ok');
                  if (result.receipt?.tokens?.length) {
                    V.toast('Tu token', result.receipt.tokens.map((token) => token.code).join(' · '), 'ok');
                  }
                  await renderStore();
                } catch (error) {
                  V.toast('No se pudo comprar', error.message, 'err');
                }
              },
            }),
          ]),
        ]),
      ),
    );
  }

  // Tienda de monedas (economía)
  const coinShop = document.getElementById('coinShop');
  if (coinShop) {
    coinShop.replaceChildren(
      ...economy.items.map((item) =>
        V.el('div', { class: 'card catalog-card' }, [
          V.el('div', { class: 'catalog-top' }, [
            V.el('span', { class: 'catalog-emoji', text: item.kind === 'space' ? '💾' : item.kind === 'token' ? '🎟️' : item.kind === 'plan' ? '👑' : '✨' }),
            V.el('div', { class: 'grow' }, [
              V.el('div', { class: 'row-between' }, [
                V.el('b', { text: item.name }),
                V.el('span', { class: 'price-tag coins', text: `${V.num(item.price_coins)} 🪙` }),
              ]),
              V.el('p', { class: 'small muted', style: 'margin:6px 0 0', text: item.description }),
            ]),
          ]),
          V.el('div', { class: 'row-between' }, [
            item.badge ? V.el('span', { class: 'pill accent', text: item.badge }) : V.el('span', {}),
            V.el('button', {
              class: 'btn btn-sm',
              type: 'button',
              text: 'Comprar con monedas',
              onclick: async () => {
                try {
                  const result = await V.api('/api/economy/buy', { body: { itemId: item.id } });
                  V.toast('Compra realizada', result.receipt?.message ?? 'Listo.', 'ok');
                  await renderStore();
                } catch (error) {
                  V.toast('No se pudo comprar', error.message, 'err');
                }
              },
            }),
          ]),
        ]),
      ),
    );
  }

  // Catálogo de bots (gratis / monedas / pago)
  renderCatalogFilters(catalog.categories ?? []);
  renderCatalogList('Todos');

  // Mis tokens
  const tokensBox = document.getElementById('myTokens');
  if (tokensBox) {
    const unused = (store.tokens ?? []).filter((token) => token.status === 'unused');
    tokensBox.replaceChildren(
      ...(unused.length
        ? unused.map((token) =>
            V.el('div', { class: 'card card-pad-sm row-between' }, [
              V.el('span', { class: 'mono small', text: token.code }),
              V.el('span', { class: `pill ${token.type === 'vip' ? 'accent' : 'amber'}`, text: `${token.type.toUpperCase()} · ${token.space_gb} GB` }),
            ]),
          )
        : [V.note('No tienes tokens sin usar. Compra uno para activar instancias Premium o VIP.')]),
    );
  }

  // Historial de compras
  const history = document.getElementById('purchaseHistory');
  if (history) {
    history.replaceChildren(
      ...(store.purchases?.length
        ? store.purchases.map((purchase) =>
            V.el('div', { class: 'kv' }, [
              V.el('div', {}, [
                V.el('span', { text: `${purchase.item_name} ×${purchase.quantity}` }),
                V.el('span', { class: 'mono tiny', text: Number(purchase.price_usd) > 0 ? `$${Number(purchase.price_usd).toFixed(2)}` : 'V-Coins' }),
              ]),
            ]),
          )
        : [V.note('Todavía no compraste nada.')]),
    );
  }
}

function renderCatalogFilters(categories) {
  const box = document.getElementById('catalogFilters');
  if (!box) return;
  box.replaceChildren(
    ...['Todos', ...categories].map((category) =>
      V.el('button', {
        class: `tab ${category === 'Todos' ? 'is-active' : ''}`,
        type: 'button',
        text: category,
        onclick: (event) => {
          V.qsa('#catalogFilters .tab').forEach((tab) => tab.classList.remove('is-active'));
          event.currentTarget.classList.add('is-active');
          renderCatalogList(category);
        },
      }),
    ),
  );
}

function renderCatalogList(category) {
  const box = document.getElementById('catalogList');
  if (!box) return;
  const bots = (APP.catalog.bots ?? []).filter((bot) => category === 'Todos' || bot.category === category);
  box.replaceChildren(
    ...bots.map((bot) => {
      const price = bot.pricing === 'free' ? 'GRATIS' : bot.pricing === 'coins' ? `${V.num(bot.price_coins)} 🪙` : `$${Number(bot.priceUsd).toFixed(2)}`;
      return V.el('div', { class: 'card catalog-card' }, [
        V.el('div', { class: 'catalog-top' }, [
          V.el('span', { class: 'catalog-emoji', style: `box-shadow:0 0 0 1px ${bot.accent}55, 0 10px 26px ${bot.accent}33`, text: bot.emoji }),
          V.el('div', { class: 'grow' }, [
            V.el('div', { class: 'row-between' }, [
              V.el('div', {}, [
                V.el('b', { text: bot.name }),
                V.el('div', { class: 'tiny muted', text: bot.tagline }),
              ]),
              V.el('span', { class: `price-tag ${bot.pricing}`, text: price }),
            ]),
            V.el('div', { class: 'chips', style: 'margin-top:8px' }, [
              V.el('span', { class: 'pill', text: bot.category }),
              bot.badge ? V.el('span', { class: 'pill accent', text: bot.badge }) : null,
              V.el('span', { class: 'pill green', text: `${V.num(bot.users)} usos` }),
              bot.owned ? V.el('span', { class: 'pill blue', text: '✓ Activo' }) : null,
            ]),
          ]),
        ]),
        V.el('p', { class: 'small muted', style: 'margin:0', text: bot.description }),
        V.el('ul', { class: 'feature-list' }, (bot.features ?? []).slice(0, 4).map((feature) => V.el('li', { text: feature }))),
        V.el('div', { class: 'row wrap-text' }, (bot.commands ?? []).slice(0, 6).map((command) => V.el('span', { class: 'pill mono', text: `/${command}` }))),
        V.el('div', { class: 'row' }, [
          V.el('button', {
            class: `btn btn-sm ${bot.pricing === 'free' ? 'btn-primary' : ''}`,
            type: 'button',
            text: bot.owned ? 'Ya activado' : bot.pricing === 'free' ? 'Activar gratis' : bot.pricing === 'coins' ? 'Activar con monedas' : 'Comprar y activar',
            disabled: bot.owned,
            onclick: async () => {
              try {
                const result = await V.api(`/api/catalog/${bot.slug}/use`, { body: {} });
                V.toast('Bot activado', result.message, 'ok');
                await renderStore();
              } catch (error) {
                V.toast('No se pudo activar', error.message, 'err');
                if (error.status === 402) {
                  V.toast('Faltan monedas', `Necesitas ${V.num(error.data?.priceCoins ?? bot.price_coins)} 🪙. Compra un pack o reclama misiones.`, 'err');
                }
              }
            },
          }),
          V.el('a', { class: 'btn btn-sm btn-ghost', href: '/registrar', text: 'Registrar instancia' }),
        ]),
      ]);
    }),
  );
}

/* ================================ MÉTRICAS =============================== */

async function renderMetrics() {
  const system = await V.api('/api/system').catch(() => null);
  const metrics = await V.api('/api/metrics').catch(() => null);
  const platform = await V.loadPlatform();

  if (system) {
    V.setText('mNode', system.node);
    V.setText('mPlatform', system.platform);
    V.setText('mCpuCores', String(system.cpuCores));
    V.setText('mUptime', V.uptime(system.uptimeSec));
    V.setText('mCpu', `${system.cpuPercent}%`);
    V.setText('mRam', `${system.memory.usedPercent}%`);
    V.setText('mRamDetail', `Usado: ${system.memory.usedGb} GB · Total: ${system.memory.totalGb} GB · Libre: ${system.memory.freeGb} GB`);
    V.setText('mDisk', system.disk ? `${system.disk.usedPercent}%` : '—');
    V.setText('mDiskDetail', system.disk ? `Usado: ${system.disk.usedGb} GB · Total: ${system.disk.totalGb} GB · Libre: ${system.disk.freeGb} GB` : 'Sin datos de disco');
    V.setText('mDb', system.dbLatencyMs === null ? 'Sin conexión' : `${system.dbLatencyMs} ms`);
    V.setText('mMode', system.memoryMode ? 'Modo memoria' : 'PostgreSQL');
    const cpuMeter = document.getElementById('mCpuMeter');
    if (cpuMeter) cpuMeter.replaceWith(Object.assign(V.meter(system.cpuPercent, system.cpuPercent > 80), { id: 'mCpuMeter' }));
    const ramMeter = document.getElementById('mRamMeter');
    if (ramMeter) ramMeter.replaceWith(Object.assign(V.meter(system.memory.usedPercent, system.memory.usedPercent > 85), { id: 'mRamMeter' }));
    const diskMeter = document.getElementById('mDiskMeter');
    if (diskMeter && system.disk) diskMeter.replaceWith(Object.assign(V.meter(system.disk.usedPercent, system.disk.usedPercent > 85), { id: 'mDiskMeter' }));
  }

  if (metrics?.metrics) {
    V.setText('mgGroups', V.num(metrics.metrics.groups));
    V.setText('mgMembers', V.num(metrics.metrics.members));
    V.setText('mgActive', V.num(metrics.metrics.activeMembers));
    V.setText('mgUsers', V.num(metrics.metrics.users));
    V.setText('mgCharacters', V.num(metrics.metrics.characters));
    V.setText('mgWarnings', V.num(metrics.metrics.warnings));
  }

  if (platform) {
    V.setText('mBots', String(platform.counts.totalBots));
    V.setText('mBotsDetail', `Mains: ${platform.counts.main} · Premium: ${platform.counts.premium} · Subs: ${platform.counts.subs}`);
    V.setText('mCommands', String(platform.counts.implemented));
    V.setText('mCatalog', String(platform.counts.catalogBots));
    const servers = document.getElementById('mServers');
    if (servers) {
      servers.replaceChildren(
        ...platform.servers.map((server) =>
          V.el('div', { class: 'card card-soft card-pad-sm', style: 'display:grid;gap:10px' }, [
            V.el('div', { class: 'row-between' }, [
              V.el('div', {}, [
                V.el('b', { text: server.name }),
                V.el('div', { class: 'tiny muted', text: `${server.provider} · ${server.region} · ${server.ip}` }),
              ]),
              V.el('span', { class: server.status === 'online' ? 'pill green' : server.status === 'full' ? 'pill amber' : 'pill red', text: server.status.toUpperCase() }),
            ]),
            V.meter((server.used / server.capacity) * 100, server.used / server.capacity > 0.85),
            V.el('div', { class: 'row-between tiny muted' }, [
              V.el('span', { text: `Bots ${server.used}/${server.capacity}` }),
              V.el('span', { text: `CPU ${server.cpu}% · RAM ${server.ram}% · Disco ${server.disk}%` }),
            ]),
          ]),
        ),
      );
    }
  }

  startLogStream();
}

function startLogStream() {
  const box = document.getElementById('logBox');
  if (!box || APP.stream) return;
  const paint = (entry) => {
    const line = V.el('div', { class: `log-line ${entry.level ?? 'info'}` }, [
      V.el('span', { class: 'lvl', text: entry.level ?? 'info' }),
      V.el('span', { class: 'muted', text: new Date(entry.at ?? Date.now()).toLocaleTimeString('es-UY') }),
      V.el('span', { class: 'grow wrap-text', text: `[${entry.scope ?? 'app'}] ${entry.message ?? ''}` }),
    ]);
    box.prepend(line);
    while (box.childElementCount > 120) box.lastElementChild?.remove();
  };
  try {
    const stream = new EventSource('/api/logs/stream');
    stream.onmessage = (event) => {
      try {
        paint(JSON.parse(event.data));
      } catch {
        /* mensaje no válido */
      }
    };
    stream.onerror = () => V.setText('logState', 'Reconectando…');
    APP.stream = stream;
  } catch {
    V.setText('logState', 'No disponible');
  }
}

/* ============================== COMANDOS ================================= */

async function renderCommands() {
  const data = await V.api('/api/commands');
  const commands = data.commands ?? [];
  V.setText('cmdCount', String(commands.length));
  V.setText('cmdImplemented', String(commands.filter((command) => command.implemented).length));
  V.setText('cmdPending', String(commands.filter((command) => !command.implemented).length));
  V.setText('cmdCategories', String(new Set(commands.map((command) => command.category)).size));

  const list = document.getElementById('commandsList');
  const filters = document.getElementById('commandFilters');
  if (!list) return;
  const categories = ['Todas', ...new Set(commands.map((command) => command.category))];

  const paint = (category) => {
    const visible = commands.filter((command) => category === 'Todas' || command.category === category);
    list.replaceChildren(
      ...visible.map((command) =>
        V.el('div', { class: 'card card-soft card-pad-sm' }, [
          V.el('div', { class: 'row-between' }, [
            V.el('span', { class: 'mono', text: command.usage }),
            V.el('span', { class: `pill ${command.implemented ? (command.enabled ? 'green' : 'amber') : 'red'}`, text: command.implemented ? (command.enabled ? 'Activo' : 'Desactivado') : 'Pendiente' }),
          ]),
          V.el('p', { class: 'small muted', style: 'margin:8px 0 0', text: command.description }),
          V.el('div', { class: 'chips', style: 'margin-top:8px' }, [
            V.el('span', { class: 'pill', text: command.category }),
            ...(command.aliases ?? []).map((alias) => V.el('span', { class: 'pill mono', text: `.${alias}` })),
          ]),
        ]),
      ),
    );
  };

  if (filters) {
    filters.replaceChildren(
      ...categories.map((category) =>
        V.el('button', {
          class: `tab ${category === 'Todas' ? 'is-active' : ''}`,
          type: 'button',
          text: category,
          onclick: (event) => {
            V.qsa('#commandFilters .tab').forEach((tab) => tab.classList.remove('is-active'));
            event.currentTarget.classList.add('is-active');
            paint(category);
          },
        }),
      ),
    );
  }
  paint('Todas');

  const menu = document.getElementById('menuPreview');
  if (menu) {
    try {
      const preview = await V.api('/api/menu');
      menu.textContent = preview.text;
    } catch {
      menu.textContent = 'El menú no está disponible.';
    }
  }
}

/* ============================== REPORTES ================================= */

async function renderReports() {
  const user = await V.ensureSession();
  if (!user) return;
  const data = await V.api('/api/reports');
  const box = document.getElementById('reportsList');
  const stats = document.getElementById('reportStats');
  if (stats) {
    const reports = data.reports.filter((report) => report.kind === 'report').length;
    stats.replaceChildren(
      V.statTile('Total', String(data.reports.length), 'Envíos'),
      V.statTile('Reportes', String(reports), 'Problemas'),
      V.statTile('Sugerencias', String(data.reports.length - reports), 'Ideas'),
    );
  }
  if (!box) return;
  box.replaceChildren(
    ...(data.reports.length
      ? data.reports.map((report) =>
          V.el('div', { class: 'card card-soft card-pad-sm' }, [
            V.el('div', { class: 'row-between' }, [
              V.el('span', { class: `pill ${report.kind === 'report' ? 'amber' : 'accent'}`, text: report.kind === 'report' ? 'Reporte' : 'Sugerencia' }),
              V.el('span', { class: 'tiny muted', text: V.timeAgo(report.created_at) }),
            ]),
            V.el('p', { class: 'small', style: 'margin:10px 0 6px', text: report.text }),
            V.el('div', { class: 'row-between tiny muted' }, [
              V.el('span', { text: report.username || 'Anónimo' }),
              V.el('span', { class: `pill ${report.status === 'done' ? 'green' : 'amber'}`, text: report.status }),
            ]),
          ]),
        )
      : [V.note('Todavía no enviaste nada.')]),
  );
}

async function submitReport(event) {
  event?.preventDefault?.();
  const kind = document.getElementById('reportKind')?.value === 'suggestion' ? 'suggestion' : 'report';
  const text = document.getElementById('reportText')?.value ?? '';
  const username = document.getElementById('reportName')?.value ?? '';
  const whatsapp = document.getElementById('reportPhone')?.value ?? '';
  try {
    await V.api('/api/reports', { body: { kind, text, username, whatsapp } });
    V.toast('Enviado', 'El equipo de moderación revisará tu envío.', 'ok');
    const textarea = document.getElementById('reportText');
    if (textarea) textarea.value = '';
    await renderReports();
  } catch (error) {
    V.toast('No se pudo enviar', error.message, 'err');
  }
}

/* ------------------- atajos de la tarjeta de vinculación ------------------ */

document.getElementById('phone')?.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    event.preventDefault?.();
    requestPairingCode();
  }
});
document.getElementById('pair')?.addEventListener('click', () => requestPairingCode());

/* ================================ ARRANQUE =============================== */

async function boot() {
  const storedTheme = (() => {
    try {
      return localStorage.getItem('versova-theme');
    } catch {
      return null;
    }
  })();
  V.applyTheme(document.documentElement.dataset.theme || storedTheme || 'dark');

  if (!document.body) return;
  V.buildChrome();

  const page = document.documentElement.dataset.page || 'home';
  await V.loadSession();
  renderAuthArea().catch(() => undefined);

  switch (page) {
    case 'home':
      await renderHome();
      break;
    case 'registrar':
      await renderRegistrar();
      break;
    case 'bots':
      await renderBots();
      break;
    case 'store':
      await renderStore();
      break;
    case 'metrics':
      await renderMetrics();
      break;
    case 'cmds':
      await renderCommands();
      break;
    case 'ticket':
      await renderReports();
      break;
    case 'links':
      renderLinks();
      break;
    case 'menu':
      renderMenuPage();
      break;
    default:
      break;
  }

  if (new URLSearchParams(window.location.search).has('login')) openAuth('login');
  document.getElementById('themeToggle')?.addEventListener('click', () => V.applyTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'));
  document.getElementById('wizardCreate')?.addEventListener('click', createBotFromWizard);
  document.getElementById('wizardConfirm')?.addEventListener('click', confirmPairing);
  document.getElementById('saveBotOptions')?.addEventListener('click', saveBotOptions);
  document.getElementById('reportForm')?.addEventListener('submit', submitReport);
  document.getElementById('authForm')?.addEventListener('submit', submitAuth);
  document.getElementById('authSwitch')?.addEventListener('click', () => setAuthMode(document.getElementById('authModal')?.dataset.mode === 'login' ? 'register' : 'login'));

  for (const [id, step] of [['wizardNext1', 1], ['wizardNext2', 2], ['wizardNext3', 3]]) {
    document.getElementById(id)?.addEventListener('click', () => {
      if (step === 3) {
        const phone = document.getElementById('wizardPhone')?.value?.trim() ?? '';
        if (phone.replace(/\D/g, '').length < 8) {
          V.toast('Número incompleto', 'Escribe el número del bot con código de país.', 'err');
          return;
        }
        APP.wizard.phone = phone;
      }
      showWizardStep(step);
    });
  }
  for (const [id, step] of [['wizardBack1', 0], ['wizardBack2', 1], ['wizardBack3', 2], ['wizardBack4', 3]]) {
    document.getElementById(id)?.addEventListener('click', () => showWizardStep(step));
  }
  document.getElementById('wizardPhone')?.addEventListener('input', (event) => {
    APP.wizard.phone = event.currentTarget.value;
  });
  document.getElementById('regenerateCode')?.addEventListener('click', showPairingStep);

  V.hideLoading();
}

// El armazón (V) lo aporta shell.js: sin él, este archivo solo expone sus funciones.
if (typeof V !== 'undefined') {
  try {
    boot().catch((error) => {
      console.warn('No se pudo iniciar la página:', error);
      V.hideLoading();
      V.toast('Error al cargar', String(error?.message ?? error), 'err');
    });
  } catch (error) {
    console.warn('Arranque fallido:', error);
  }
}
