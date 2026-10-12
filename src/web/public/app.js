/**
 * VÉRSOVA · interfaz web (una sola app para tres rutas):
 *   /        landing  (data-page="landing")
 *   /home    panel    (data-page="home")
 *   /cmds    catálogo (data-page="cmds")
 * El panel es público: no hay autenticación.
 */

const $ = (id) => document.getElementById(id);

const toastElement = () => $('toast');
let toastTimer = null;

function toast(message) {
  const box = toastElement();
  if (!box) return;
  box.textContent = message;
  box.classList.add('show');
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => box.classList.remove('show'), 2200);
}

async function api(path, options = {}) {
  const headers = { Accept: 'application/json', ...(options.headers ?? {}) };
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  const response = await fetch(path, { cache: 'no-store', ...options, headers });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error ?? `Error ${response.status}`);
  return data;
}

/** Igual que api() pero devuelve null en vez de lanzar (para datos opcionales). */
async function apiOrNull(path, options) {
  try {
    return await api(path, options);
  } catch {
    return null;
  }
}

const setText = (id, value) => {
  const element = $(id);
  if (element) element.textContent = value === null || value === undefined || value === '' ? '—' : String(value);
};

const setWidth = (id, percent) => {
  const element = $(id);
  if (element) element.style.width = `${Math.max(0, Math.min(100, Number(percent) || 0))}%`;
};

const number = (value) => new Intl.NumberFormat('es-UY').format(Number(value) || 0);

function countUp(id, value) {
  const element = $(id);
  if (!element) return;
  const target = Number(value) || 0;
  const start = Number(element.dataset.count) || 0;
  element.dataset.count = String(target);
  if (typeof requestAnimationFrame !== 'function' || target === start) {
    element.textContent = number(target);
    return;
  }
  const started = Date.now();
  const from = start;
  const step = () => {
    const elapsed = Math.min(1, (Date.now() - started) / 800);
    const eased = 1 - (1 - elapsed) ** 3;
    element.textContent = number(Math.round(from + (target - from) * eased));
    if (elapsed < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

function formatDuration(seconds) {
  const totalMinutes = Math.max(0, Math.floor((Number(seconds) || 0) / 60));
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  if (days) return `${days} d ${hours} h`;
  if (hours) return `${hours} h ${minutes} min`;
  return `${minutes} min`;
}

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('es-UY', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function greetingFor(hour) {
  if (hour < 6) return { title: 'BUENAS MADRUGADAS', hello: 'Aún despierto, bienvenido' };
  if (hour < 12) return { title: 'BUENOS DÍAS', hello: 'Hola, bienvenido' };
  if (hour < 20) return { title: 'BUENAS TARDES', hello: 'Hola, bienvenido' };
  return { title: 'BUENAS NOCHES', hello: 'Hola, bienvenido' };
}

/* ------------------------------- tema ---------------------------------- */
function applyTheme(theme) {
  const selected = theme === 'light' ? 'light' : 'dark';
  document.documentElement.dataset.theme = selected;
  const toggle = $('themeToggle');
  toggle.setAttribute('aria-pressed', String(selected === 'dark'));
  toggle.setAttribute('aria-label', selected === 'light' ? 'Activar modo oscuro' : 'Activar modo claro');
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', selected === 'dark' ? '#05060f' : '#f4f4fb');
  try {
    localStorage.setItem('versova.theme', selected);
  } catch {
    /* almacenamiento opcional */
  }
}

function initTheme() {
  let saved = null;
  try {
    saved = localStorage.getItem('versova.theme');
  } catch {
    /* almacenamiento opcional */
  }
  applyTheme(saved || 'dark');
  $('themeToggle').addEventListener('click', () => {
    applyTheme(document.documentElement.dataset.theme === 'light' ? 'dark' : 'light');
  });
}

/* ------------------------------ estado -------------------------------- */
const BADGE = {
  open: ['En línea', 'open'],
  qr: ['Esperando vinculación', ''],
  connecting: ['Conectando…', ''],
  closed: ['Reconectando', 'bad'],
  logged_out: ['Sesión cerrada', 'bad'],
  idle: ['Iniciando', ''],
};

let lastStatus = {};

const setBadge = (id, label, cls) => {
  const badge = $(id);
  if (!badge) return;
  badge.className = `status-badge ${cls}`.trim();
  const inner = badge.querySelector('span:last-child');
  if (inner) inner.textContent = label;
};

const setPill = (id, label, cls) => {
  const pill = $(id);
  if (!pill) return;
  pill.className = `pill ${cls}`.trim();
  const inner = pill.querySelector('span:last-child');
  if (inner) inner.textContent = label;
};

function paintStatus(status) {
  lastStatus = status ?? {};
  const [label, cls] = BADGE[lastStatus.whatsapp] ?? [lastStatus.whatsapp ?? 'Desconocido', 'bad'];
  const pillClass = cls === 'open' ? 'ok' : cls === 'bad' ? 'bad' : '';

  setBadge('statusBadge', label, cls);
  setBadge('sideBadge', label, cls);
  setBadge('botBadge', label, cls);
  for (const id of ['statusPill', 'heroStatusPill', 'heroPill', 'navStatus']) {
    setPill(id, label, pillClass);
    $(id)?.querySelector('.live-dot')?.classList.toggle('off', cls !== 'open');
  }

  setText('sideDetail', lastStatus.me ? `Número ${lastStatus.me}` : lastStatus.team ?? 'Buscando estado…');
  setText('statusDetail', lastStatus.me ? `Número ${lastStatus.me} · ${lastStatus.team}` : (lastStatus.team ?? 'Buscando estado…'));
  const uptimeText = `${formatDuration(lastStatus.uptimeSec)} · versión ${lastStatus.version ?? '—'}`;
  setText('uptime', uptimeText);
  setText('statUptime', formatDuration(lastStatus.uptimeSec));
  setText('infoNumber', lastStatus.me ?? 'sin vincular');
  setText('infoTeam', lastStatus.team);
  setText('infoVersion', lastStatus.version);
  setText('infoSession', lastStatus.linked ? 'vinculada' : 'pendiente');
  setText('botNumber', lastStatus.me ? `Número ${lastStatus.me}` : 'Número sin vincular');
  setText('botName', lastStatus.bot);
  setText('botTeam', lastStatus.team);
  setText('botPrefix', lastStatus.prefix);
  setText('heroBot', lastStatus.bot);
  setText('heroBotName', lastStatus.bot);
  setText('heroTeam', lastStatus.me ? `${lastStatus.team} · ${lastStatus.me}` : lastStatus.team);
  setText('heroPrefix', lastStatus.prefix);
  setText('heroVersion', lastStatus.version);
  setText('heroUptime', formatDuration(lastStatus.uptimeSec));
  setText('heroTeamPill', lastStatus.team);
  const flag = $('botFlagSession');
  if (flag) flag.className = `pill ${lastStatus.linked ? 'ok' : ''}`.trim();
}

async function refreshStatus() {
  try {
    const status = await api('/api/status');
    paintStatus(status);
    renderQr(status);
    if (!pairingBusy) {
      pairingCode = status.pairingCode ?? null;
      pairingExpiresAt = status.pairingExpiresAt ?? null;
    }
    renderPairingCode();
    renderPairingControls(status);
  } catch (error) {
    $('statusBadge').className = 'status-badge bad';
    $('statusBadge').querySelector('span:last-child').textContent = 'Sin conexión';
    setText('statusDetail', error.message);
    const pill = $('statusPill');
    if (pill) {
      pill.className = 'pill bad';
      pill.querySelector('span:last-child').textContent = 'Sin conexión';
    }
  }
}

function renderQr(status) {
  const image = $('qr');
  const empty = $('qrEmpty');
  if (!image || !empty) return;
  if (status.qr) {
    image.src = status.qr;
    image.hidden = false;
    empty.hidden = true;
  } else {
    image.removeAttribute('src');
    image.hidden = true;
    empty.hidden = false;
    empty.textContent = status.whatsapp === 'open' ? 'El dispositivo ya está vinculado.' : 'No hay un QR pendiente.';
  }
}

/* ---------------------------- emparejamiento --------------------------- */
let pairingCode = null;
let pairingExpiresAt = null;
let pairingTicker = null;
let pairingBusy = false;

function stopPairingTicker() {
  if (pairingTicker) {
    window.clearInterval(pairingTicker);
    pairingTicker = null;
  }
}

/** Muestra el código solo mientras siga vigente; al expirar lo quita y avisa. */
function renderPairingCode() {
  const now = Date.now();
  const active = Boolean(pairingCode && pairingExpiresAt && pairingExpiresAt > now);

  $('pairCode').hidden = !active;
  $('pairCountdown').hidden = !active;

  if (active) {
    $('pairCode').textContent = pairingCode;
    const left = Math.ceil((pairingExpiresAt - now) / 1000);
    $('pairCountdown').textContent =
      `Expira en ${left} s · WhatsApp → Ajustes → Dispositivos vinculados → Vincular con el número de teléfono`;
  } else {
    stopPairingTicker();
    if (pairingCode) {
      pairingCode = null;
      pairingExpiresAt = null;
      if (!pairingBusy) {
        $('pairError').textContent = 'El código expiró antes de usarse. Pide uno nuevo e ingrésalo enseguida.';
        $('pairError').hidden = false;
      }
    }
    return;
  }

  if (!pairingTicker) pairingTicker = window.setInterval(renderPairingCode, 1000);
}

/** El botón solo sirve cuando WhatsApp puede aceptar un código por teléfono. */
function renderPairingControls(status) {
  if (!status) return;
  const linked = Boolean(status.linked);
  const ready = Boolean(status.pairingReady);
  const hint = $('pairHint');

  if (linked) hint.textContent = 'El bot ya está vinculado. Cierra la sesión para vincular otro número.';
  else if (!ready) hint.textContent = 'Esperando a que la conexión entre en modo vinculación (ocurre cuando aparece el QR).';
  hint.hidden = linked || ready;

  if (!pairingBusy) $('pair').disabled = linked || !ready;
}

async function requestPairingCode() {
  $('pairError').hidden = true;
  $('pairCode').hidden = true;
  $('pairCountdown').hidden = true;
  pairingCode = null;
  pairingExpiresAt = null;
  stopPairingTicker();
  pairingBusy = true;
  $('pair').disabled = true;
  $('pair').textContent = 'Pidiendo…';
  try {
    const result = await api('/api/pair', {
      method: 'POST',
      body: JSON.stringify({ phone: $('phone').value }),
    });
    pairingCode = result.code;
    pairingExpiresAt = result.expiresAt ?? Date.now() + 60_000;
  } catch (error) {
    $('pairError').textContent = error.message;
    $('pairError').hidden = false;
  } finally {
    pairingBusy = false;
    $('pair').disabled = false;
    $('pair').textContent = 'Pedir código';
    renderPairingCode();
  }
}

async function requestLogout() {
  if (!confirm('¿Cerrar la sesión de WhatsApp? Tendrás que volver a vincular el bot. Esta acción está disponible para cualquiera que visite el panel público.')) return;
  $('logout').disabled = true;
  try {
    await api('/api/logout', { method: 'POST' });
    await refreshStatus();
    toast('Sesión cerrada.');
  } catch (error) {
    alert(error.message);
  } finally {
    $('logout').disabled = false;
  }
}

function copyText(value, message = 'Copiado.') {
  if (typeof navigator === 'undefined' || !navigator.clipboard) {
    toast(value);
    return;
  }
  navigator.clipboard.writeText(value).then(() => toast(message)).catch(() => toast(value));
}

/* -------------------------------- banner ------------------------------- */
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1]);
    reader.onerror = () => reject(new Error('No se pudo leer la imagen.'));
    reader.readAsDataURL(file);
  });
}

async function refreshBanner() {
  if (!$('bannerText')) return;
  try {
    const banner = await api('/api/banner');
    $('bannerText').value = banner.text;
    $('bannerText').placeholder = banner.defaultText;
    $('bannerImageState').textContent = banner.hasImage ? `Imagen activa · ${banner.imageMime}` : 'Sin imagen';
    $('removeImage').disabled = !banner.hasImage;
  } catch (error) {
    showBannerMessage(`No se pudo cargar el banner: ${error.message}`, true);
  }
}

function showBannerMessage(text, isError = false) {
  const message = $('bannerMsg');
  if (!message) return;
  message.textContent = text;
  message.className = `form-message ${isError ? 'error' : ''}`.trim();
  message.hidden = false;
}

async function saveBanner() {
  const button = $('saveBanner');
  const file = $('bannerImage').files[0];
  const body = { text: $('bannerText').value };
  button.disabled = true;
  try {
    if (file) body.image = { mime: file.type, data: await fileToBase64(file) };
    await api('/api/banner', { method: 'PUT', body: JSON.stringify(body) });
    $('bannerImage').value = '';
    showBannerMessage('Banner guardado.');
    toast('Banner guardado.');
    await Promise.all([refreshBanner(), refreshMenuPreview()]);
  } catch (error) {
    showBannerMessage(error.message, true);
  } finally {
    button.disabled = false;
  }
}

async function removeBannerImage() {
  $('removeImage').disabled = true;
  try {
    await api('/api/banner/image', { method: 'DELETE' });
    showBannerMessage('Imagen quitada.');
    await Promise.all([refreshBanner(), refreshMenuPreview()]);
  } catch (error) {
    showBannerMessage(error.message, true);
    $('removeImage').disabled = false;
  }
}

/* ------------------------------- comandos ------------------------------ */
let commandSettings = null;
let commandInventory = [];
let commandCategory = 'Todos';

function makeElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function updateSet(list, name, shouldContain) {
  const values = new Set(list);
  if (shouldContain) values.add(name);
  else values.delete(name);
  return [...values];
}

function cloneSettings(settings) {
  return {
    ...settings,
    disabled: [...settings.disabled],
    hidden: [...settings.hidden],
    aliases: Object.fromEntries(Object.entries(settings.aliases).map(([name, values]) => [name, [...values]])),
  };
}

async function saveCommandConfiguration(next, successMessage = 'Guardado.') {
  const state = $('commandSaveState');
  if (state) state.textContent = 'Guardando…';
  try {
    const result = await api('/api/commands', { method: 'PUT', body: JSON.stringify(next) });
    commandSettings = result.settings;
    commandInventory = result.commands;
    $('commandDecoration').value = commandSettings.commandDecoration;
    renderCommands();
    if (state) state.textContent = successMessage;
    await refreshMenuPreview();
    window.setTimeout(() => {
      if (state && state.textContent === successMessage) state.textContent = '';
    }, 2600);
    return true;
  } catch (error) {
    if (state) state.textContent = error.message;
    window.setTimeout(() => {
      if (state) state.textContent = '';
    }, 3200);
    return false;
  }
}

function renderAliasList(command) {
  const wrapper = makeElement('div', 'command-aliases');
  const aliases = commandSettings.aliases[command.name] ?? [];
  for (const alias of aliases) {
    const chip = makeElement('span', 'alias-chip', `.${alias}`);
    const remove = makeElement('button', 'alias-remove', '×');
    remove.type = 'button';
    remove.title = `Eliminar alias .${alias}`;
    remove.setAttribute('aria-label', `Eliminar alias .${alias}`);
    remove.addEventListener('click', async () => {
      const next = cloneSettings(commandSettings);
      next.aliases[command.name] = next.aliases[command.name].filter((item) => item !== alias);
      if (!next.aliases[command.name].length) delete next.aliases[command.name];
      await saveCommandConfiguration(next, `Alias .${alias} eliminado.`);
    });
    chip.append(remove);
    wrapper.append(chip);
  }

  if (command.implemented) {
    const form = makeElement('form', 'alias-form');
    const input = makeElement('input');
    input.type = 'text';
    input.maxLength = 25;
    input.placeholder = 'nuevo alias';
    input.autocomplete = 'off';
    input.setAttribute('aria-label', `Nuevo alias para .${command.name}`);
    input.addEventListener('input', () => input.setCustomValidity(''));
    const add = makeElement('button', '', '＋ Alias');
    add.type = 'submit';
    form.append(input, add);
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const alias = input.value.trim().replace(/^\./, '').toLowerCase();
      if (!alias) return;
      const next = cloneSettings(commandSettings);
      const values = next.aliases[command.name] ?? [];
      if (values.includes(alias)) {
        input.setCustomValidity('Ese alias ya existe.');
        input.reportValidity();
        return;
      }
      next.aliases[command.name] = [...values, alias];
      const saved = await saveCommandConfiguration(next, `Alias .${alias} creado.`);
      if (!saved) input.focus();
    });
    wrapper.append(form);
  }

  return wrapper;
}

function makeCommandControl(command, kind) {
  const label = makeElement('label', 'command-control');
  const input = makeElement('input');
  input.type = 'checkbox';
  input.checked = kind === 'enabled' ? command.enabled : command.visible;
  const switchUI = makeElement('span', 'control-switch');
  const text = makeElement('span', '', kind === 'enabled' ? 'Activo' : 'En menú');
  label.append(input, switchUI, text);
  input.addEventListener('change', async () => {
    const next = cloneSettings(commandSettings);
    if (kind === 'enabled') next.disabled = updateSet(next.disabled, command.name, !input.checked);
    else next.hidden = updateSet(next.hidden, command.name, !input.checked);
    await saveCommandConfiguration(next, `.${command.name} actualizado.`);
  });
  return label;
}

async function removeOrRestoreCommand(command) {
  const next = cloneSettings(commandSettings);
  const isRemoved = command.implemented ? (!command.enabled || !command.visible) : !command.visible;
  if (isRemoved) {
    next.hidden = updateSet(next.hidden, command.name, false);
    next.disabled = updateSet(next.disabled, command.name, false);
    await saveCommandConfiguration(next, `.${command.name} restaurado.`);
  } else {
    next.hidden = updateSet(next.hidden, command.name, true);
    if (command.implemented) next.disabled = updateSet(next.disabled, command.name, true);
    await saveCommandConfiguration(next, `.${command.name} eliminado del menú y desactivado.`);
  }
}

function renderCategoryChips() {
  const box = $('commandCategories');
  if (!box || !commandInventory.length) return;
  const counts = new Map();
  for (const command of commandInventory) counts.set(command.category, (counts.get(command.category) ?? 0) + 1);
  const categories = ['Todos', ...[...counts.keys()].sort()];
  box.replaceChildren();
  for (const category of categories) {
    const chip = makeElement('button', `chip${commandCategory === category ? ' is-active' : ''}`);
    chip.type = 'button';
    const label = makeElement('span', '', category);
    const total = makeElement('b', '', category === 'Todos' ? commandInventory.length : counts.get(category));
    chip.append(label, total);
    chip.addEventListener('click', () => {
      commandCategory = category;
      renderCategoryChips();
      renderCommands();
    });
    box.append(chip);
  }
}

function renderCommands() {
  const list = $('commandList');
  if (!list) return;
  const query = ($('commandSearch')?.value ?? '').trim().toLowerCase();
  const visibleCommands = commandInventory.filter((command) => {
    const searchable = `${command.name} ${command.category} ${command.description} ${command.aliases.join(' ')}`.toLowerCase();
    const matchesCategory = commandCategory === 'Todos' || command.category === commandCategory;
    return matchesCategory && searchable.includes(query);
  });
  const implementedCount = commandInventory.filter((command) => command.implemented).length;
  const pendingCount = commandInventory.length - implementedCount;
  $('commandCount').textContent = `${implementedCount} listos · ${pendingCount} pendientes`;
  setText('navCommandCount', implementedCount);
  list.replaceChildren();

  if (!visibleCommands.length) {
    list.append(makeElement('p', 'empty-state', 'No se encontraron comandos.'));
    return;
  }

  for (const command of visibleCommands) {
    const row = makeElement('article', `command-row${command.enabled ? '' : ' is-disabled'}`);
    const main = makeElement('div', 'command-main');
    const title = makeElement('div', 'command-title-line');
    title.append(makeElement('span', 'command-name', `.${command.name}`));
    if (command.usage !== `.${command.name}`) title.append(makeElement('span', 'command-usage', command.usage));
    title.append(makeElement('span', 'command-category', command.category));
    title.append(makeElement('span', `command-state${command.implemented ? '' : ' pending'}`, command.implemented ? 'Disponible' : 'Pendiente'));
    main.append(title);
    main.append(makeElement('p', 'command-description', command.description));
    main.append(renderAliasList(command));

    const controls = makeElement('div', 'command-controls');
    if (command.implemented) controls.append(makeCommandControl(command, 'enabled'));
    if (command.inTemplate) controls.append(makeCommandControl(command, 'visible'));
    if (command.inTemplate) {
      const isRemoved = command.implemented ? (!command.enabled || !command.visible) : !command.visible;
      const remove = makeElement('button', `remove-command${isRemoved ? ' restore' : ''}`, isRemoved ? 'Restaurar' : command.implemented ? 'Eliminar' : 'Ocultar');
      remove.type = 'button';
      remove.addEventListener('click', () => removeOrRestoreCommand(command));
      controls.append(remove);
    }

    row.append(main, controls);
    list.append(row);
  }
}

async function loadCommands() {
  const list = $('commandList');
  if (!list) return;
  try {
    const result = await api('/api/commands');
    commandSettings = result.settings;
    commandInventory = result.commands;
    $('commandDecoration').value = commandSettings.commandDecoration;
    renderCategoryChips();
    renderCommands();
  } catch (error) {
    list.replaceChildren(makeElement('p', 'empty-state error', `No se pudieron cargar los comandos: ${error.message}`));
  }
}

async function refreshMenuPreview() {
  const preview = $('menuPreview');
  if (!preview) return;
  try {
    const result = await api('/api/menu');
    preview.textContent = result.text;
    setText('menuState', 'vista previa en vivo');
  } catch (error) {
    preview.textContent = `No se pudo cargar la vista previa: ${error.message}`;
  }
}

/* --------------------------------- logs -------------------------------- */
let eventSource = null;

function startLogs() {
  const box = $('console');
  if (!box || typeof EventSource !== 'function') return;
  eventSource?.close();
  eventSource = new EventSource('/api/logs/stream');
  eventSource.onmessage = (event) => {
    try {
      const entry = JSON.parse(event.data);
      const line = makeElement('div', `lvl-${entry.level}`, `${String(entry.time).slice(11, 19)} ${String(entry.level).toUpperCase().padEnd(5)} [${entry.scope}] ${entry.message}`);
      box.append(line);
      while (box.childElementCount > 500) box.firstElementChild.remove();
      if ($('autoscroll').checked) box.scrollTop = box.scrollHeight;
    } catch {
      /* ignora eventos malformados */
    }
  };
  eventSource.onerror = () => {
    /* EventSource reconecta solo. */
  };
}

/* ------------------------------ telemetría ----------------------------- */
async function refreshSystem() {
  const data = await apiOrNull('/api/system');
  const pill = $('monitorPill');
  if (!data) {
    if (pill) {
      pill.className = 'pill bad';
      pill.querySelector('span:last-child').textContent = 'sin datos del servidor';
    }
    return;
  }
  if (pill) {
    pill.className = 'pill ok';
    pill.querySelector('span:last-child').textContent = `medido ${new Date(data.time).toLocaleTimeString('es-UY')}`;
  }

  const cpu = Number(data.cpuPercent) || 0;
  setText('cpuValue', `${cpu.toFixed(1)} %`);
  setWidth('cpuBar', cpu);
  setText('cpuNote', `${data.cpuCores ?? '—'} núcleos · carga ${Array.isArray(data.loadAvg) ? data.loadAvg.join(' / ') : '—'}`);

  const memory = data.memory ?? {};
  setText('ramValue', `${Number(memory.usedPercent ?? 0).toFixed(1)} %`);
  setWidth('ramBar', memory.usedPercent);
  setText('ramNote', `Usado ${memory.usedGb ?? '—'} GB · Total ${memory.totalGb ?? '—'} GB · Libre ${memory.freeGb ?? '—'} GB`);

  if (data.disk) {
    setText('diskValue', `${Number(data.disk.usedPercent).toFixed(1)} %`);
    setWidth('diskBar', data.disk.usedPercent);
    setText('diskNote', `Usado ${data.disk.usedGb} GB · Total ${data.disk.totalGb} GB · Libre ${data.disk.freeGb} GB`);
  } else {
    setText('diskValue', 'sin datos');
    setWidth('diskBar', 0);
    setText('diskNote', 'El sistema de archivos no reporta métricas en este contenedor.');
  }

  const latency = data.dbLatencyMs;
  const latencyPercent = latency === null || latency === undefined ? 0 : Math.max(6, Math.min(100, 100 - latency));
  setText('netValue', latency === null || latency === undefined ? 'sin respuesta' : `${latency} ms`);
  setWidth('netBar', latencyPercent);
  setText('netNote', latency === null || latency === undefined ? 'Base de datos sin responder.' : `Latencia de PostgreSQL · ${lastStatus.whatsapp === 'open' ? 'WhatsApp en línea' : 'WhatsApp pendiente'}`);

  setText('sysHost', data.hostname);
  setText('sysPid', data.pid);
  setText('sysNode', data.node);
  setText('sysPlatform', `${data.platform ?? '—'} · ${data.arch ?? ''}`);
  setText('sysCpuModel', `${data.cpuModel ?? '—'}${data.cpuSpeedMhz ? ` @ ${data.cpuSpeedMhz} MHz` : ''}`);
  setText('sysLoad', Array.isArray(data.loadAvg) ? data.loadAvg.join(' / ') : '—');
  setText('sysUptime', formatDuration(data.systemUptimeSec));
  setText('sysTime', formatDate(data.time));
  setText('heroDb', latency === null || latency === undefined ? 'sin respuesta' : `ok · ${latency} ms`);
}

async function refreshMetrics() {
  const data = await apiOrNull('/api/metrics');
  const metrics = data?.metrics;
  if (!metrics) {
    setText('botGroups', 'sin datos');
    setText('heroDb', 'sin datos');
    return;
  }
  countUp('statUsers', metrics.users);
  countUp('statCharacters', metrics.characters);
  countUp('statGroups', metrics.groups);
  countUp('statMembers', metrics.members);
  countUp('statRequests', metrics.pendingRequests);
  countUp('statWarns', metrics.warnings);
  setText('statCharactersNote', `${number(metrics.charactersOccupied)} ocupados`);
  setText('statMembersNote', `${number(metrics.activeMembers)} activos en 7 días`);
  setText('botGroups', number(metrics.groups));
  setText('botUsers', number(metrics.users));
  setText('botCharacters', `${number(metrics.charactersOccupied)} / ${number(metrics.characters)}`);
  setText('botActivity', formatDate(metrics.lastActivityAt));
  setText('cardGroups', number(metrics.groups));
  setText('cardActive', number(metrics.activeMembers));
  setText('cardActions', number(metrics.actions));
  setText('monGroups', number(metrics.groups));
  setText('monMembers', number(metrics.members));
  setText('monUsers', number(metrics.users));
  setText('monCharacters', `${number(metrics.charactersOccupied)} / ${number(metrics.characters)}`);
  setText('monRequests', number(metrics.pendingRequests));
  setText('monWarns', number(metrics.warnings));
  setText('monActions', number(metrics.actions));
  setText('monLastActivity', formatDate(metrics.lastActivityAt));
}

/* ------------------------------ navegación ----------------------------- */
const VIEW_NAMES = {
  inicio: 'Inicio',
  conexion: 'Conexión',
  bots: 'Mis Bots',
  comandos: 'Comandos',
  identidad: 'Identidad',
  monitor: 'Monitor',
  links: 'Links',
  soporte: 'Soporte',
};

function showView(name) {
  const target = VIEW_NAMES[name] ? name : 'inicio';
  for (const link of document.querySelectorAll('[data-view]')) {
    link.classList.toggle('is-active', link.dataset.view === target);
  }
  for (const section of document.querySelectorAll('.view')) {
    section.classList.toggle('is-active', section.id === `view-${target}`);
  }
  setText('viewName', VIEW_NAMES[target]);
}

function initNav() {
  const links = document.querySelectorAll('[data-view]');
  if (!links.length) return;
  for (const link of links) {
    link.addEventListener('click', (event) => {
      event.preventDefault();
      const name = link.dataset.view;
      if (typeof location !== 'undefined') history.replaceState(null, '', `#${name}`);
      showView(name);
      if (typeof window.scrollTo === 'function') window.scrollTo({ top: 0, behavior: 'smooth' });
      if (name === 'monitor') void refreshSystem();
    });
  }
  if (typeof location !== 'undefined' && location.hash) showView(location.hash.slice(1));
  if (typeof window.addEventListener === 'function') {
    window.addEventListener('hashchange', () => {
      if (location.hash) showView(location.hash.slice(1));
    });
  }
}

/* ------------------------------- landing ------------------------------- */
async function initLanding() {
  const status = await apiOrNull('/api/status');
  if (status) paintStatus(status);

  const [commands, metrics] = await Promise.all([apiOrNull('/api/commands'), apiOrNull('/api/metrics')]);
  const inventory = commands?.commands ?? [];
  const implemented = inventory.filter((command) => command.implemented).length;
  const categories = new Set(inventory.map((command) => command.category)).size;
  countUp('heroCount', implemented);
  setText('heroCountLabel', 'Comandos disponibles');
  countUp('landCommands', inventory.length);
  countUp('landImplemented', implemented);
  countUp('landCategories', categories);
  if (metrics?.metrics) {
    countUp('landGroups', metrics.metrics.groups);
    countUp('landUsers', metrics.metrics.users);
    countUp('landCharacters', metrics.metrics.characters);
  }
  const [statusLabel] = BADGE[status?.whatsapp] ?? ['Sin datos', 'bad'];
  setText('landStatus', statusLabel);
  if (status) setText('heroDb', metrics?.metrics ? 'ok' : 'sin datos');
  await refreshMenuPreview();

  const refresh = $('refreshPreview');
  refresh?.addEventListener('click', () => refreshMenuPreview());
  if (typeof window.setInterval === 'function') window.setInterval(refreshMenuPreview, 60_000);
}

/* ------------------------------- catálogo ------------------------------ */
function renderCatalog() {
  const box = $('catalog');
  if (!box) return;
  const query = ($('commandSearch')?.value ?? '').trim().toLowerCase();
  const matches = commandInventory.filter((command) => {
    const searchable = `${command.name} ${command.category} ${command.description} ${command.aliases.join(' ')} ${command.usage}`.toLowerCase();
    const matchesCategory = commandCategory === 'Todos' || command.category === commandCategory;
    return matchesCategory && searchable.includes(query);
  });

  box.replaceChildren();
  setText('catalogCount', `${matches.length} / ${commandInventory.length}`);
  setText('catalogMeta', `${commandInventory.length} comandos · ${commandInventory.filter((c) => c.implemented).length} ya implementados · actualizado ${formatDate(new Date())}`);

  if (!matches.length) {
    box.append(makeElement('p', 'empty-state', 'No se encontraron comandos con esos filtros.'));
    return;
  }

  const groups = new Map();
  for (const command of matches) groups.set(command.category, [...(groups.get(command.category) ?? []), command]);

  for (const [category, commands] of [...groups.entries()].sort()) {
    const section = makeElement('section', 'section');
    section.style.paddingTop = '0';
    const head = makeElement('div', 'section-head');
    head.style.marginBottom = '18px';
    head.append(makeElement('p', 'eyebrow', category));
    head.append(makeElement('h3', '', `${commands.length} comando${commands.length === 1 ? '' : 's'}`));
    section.append(head);

    const grid = makeElement('div', 'catalog-grid');
    for (const command of commands) {
      const card = makeElement('button', 'cmd-card');
      card.type = 'button';
      card.title = `Copiar ${command.usage}`;
      const title = makeElement('div', '');
      title.append(makeElement('span', 'cmd-name', `.${command.name}`));
      if (command.args) title.append(makeElement('span', 'cmd-args', command.args));
      card.append(title);
      card.append(makeElement('p', '', command.description));
      if (command.aliases.length) card.append(makeElement('span', 'cmd-alias', `alias: ${command.aliases.map((alias) => `.${alias}`).join(' ')}`));
      card.append(makeElement('span', 'cmd-alias', command.implemented ? '✓ disponible' : '○ pendiente'));
      card.addEventListener('click', () => copyText(command.usage, `${command.usage} copiado.`));
      grid.append(card);
    }
    section.append(grid);
    box.append(section);
  }
}

async function initCatalog() {
  try {
    const result = await api('/api/commands');
    commandSettings = result.settings;
    commandInventory = result.commands;
    renderCategoryChips();
    renderCatalog();
  } catch (error) {
    setText('catalogMeta', `No se pudo cargar el catálogo: ${error.message}`);
    $('catalog').append(makeElement('p', 'empty-state error', 'Revisa que el servicio tenga base de datos disponible.'));
  }

  $('commandSearch')?.addEventListener('input', renderCatalog);
  if (typeof document.addEventListener === 'function') {
    document.addEventListener('keydown', (event) => {
      if (event.key === '/' && document.activeElement !== $('commandSearch')) {
        event.preventDefault();
        $('commandSearch')?.focus();
      }
    });
  }
}

/* --------------------------------- panel ------------------------------- */
async function initPanel() {
  const greeting = greetingFor(new Date().getHours());
  setText('greeting', greeting.title);

  initNav();
  $('pair').addEventListener('click', requestPairingCode);
  $('phone').addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    if (!$('pair').disabled) requestPairingCode();
  });
  $('logout').addEventListener('click', requestLogout);
  $('saveBanner').addEventListener('click', saveBanner);
  $('removeImage').addEventListener('click', removeBannerImage);
  $('bannerImage').addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (file) $('bannerImageState').textContent = `Nueva imagen · ${file.name}`;
  });
  $('saveDecoration').addEventListener('click', async () => {
    if (!commandSettings) return;
    const next = cloneSettings(commandSettings);
    next.commandDecoration = $('commandDecoration').value;
    await saveCommandConfiguration(next, 'Texto del comando actualizado.');
  });
  $('commandSearch').addEventListener('input', renderCommands);
  $('refreshPreview').addEventListener('click', refreshMenuPreview);
  $('commandDecoration').addEventListener('keydown', (event) => {
    if (event.key === 'Enter') $('saveDecoration').click();
  });
  $('pairCode').addEventListener('click', () => {
    if (pairingCode) copyText(pairingCode, 'Código copiado.');
  });

  await Promise.all([refreshStatus(), refreshBanner(), loadCommands(), refreshMenuPreview(), refreshSystem(), refreshMetrics()]);
  startLogs();
  if (typeof window.setInterval === 'function') {
    window.setInterval(refreshStatus, 5000);
    window.setInterval(refreshSystem, 15_000);
    window.setInterval(refreshMetrics, 30_000);
  }
  showView(typeof location !== 'undefined' && location.hash ? location.hash.slice(1) : 'inicio');
}

/* --------------------------------- arranque ---------------------------- */
function currentPage() {
  const page = document.documentElement?.dataset?.page;
  return page === 'landing' || page === 'cmds' ? page : 'home';
}

async function init() {
  initTheme();
  if (currentPage() === 'landing') return initLanding();
  if (currentPage() === 'cmds') return initCatalog();
  return initPanel();
}

if (typeof window.addEventListener === 'function') {
  window.addEventListener('beforeunload', () => {
    stopPairingTicker();
    eventSource?.close();
  });
}

init().catch((error) => {
  console.error('No se pudo iniciar la interfaz:', error);
});
