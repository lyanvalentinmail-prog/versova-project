const $ = (id) => document.getElementById(id);

let statusTimer = null;
let eventSource = null;
let commandSettings = null;
let commandInventory = [];

const api = async (path, options = {}) => {
  const headers = { Accept: 'application/json', ...(options.headers ?? {}) };
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  const response = await fetch(path, { cache: 'no-store', ...options, headers });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error ?? `Error ${response.status}`);
  return data;
};

function applyTheme(theme) {
  const selected = theme === 'dark' ? 'dark' : 'light';
  document.documentElement.dataset.theme = selected;
  const toggle = $('themeToggle');
  toggle.setAttribute('aria-pressed', String(selected === 'dark'));
  toggle.setAttribute('aria-label', selected === 'dark' ? 'Activar modo claro' : 'Activar modo oscuro');
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', selected === 'dark' ? '#131116' : '#f7f6f8');
  try { localStorage.setItem('versova.theme', selected); } catch { /* almacenamiento opcional */ }
}

function initTheme() {
  let saved = null;
  try { saved = localStorage.getItem('versova.theme'); } catch { /* almacenamiento opcional */ }
  applyTheme(saved || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));
  $('themeToggle').addEventListener('click', () => {
    applyTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
  });
}

const BADGE = {
  open: ['Conectado', 'open'],
  qr: ['Esperando QR', ''],
  connecting: ['Conectando…', ''],
  closed: ['Reconectando', 'bad'],
  logged_out: ['Sesión cerrada', 'bad'],
  idle: ['Iniciando', ''],
};

function formatDuration(seconds) {
  const totalMinutes = Math.max(0, Math.floor(seconds / 60));
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  if (days) return `${days} d ${hours} h activo`;
  if (hours) return `${hours} h ${minutes} min activo`;
  return `${minutes} min activo`;
}

async function refreshStatus() {
  try {
    const status = await api('/api/status');
    const [label, cls] = BADGE[status.whatsapp] ?? [status.whatsapp ?? 'Desconocido', 'bad'];
    $('statusBadge').className = `status-badge ${cls}`;
    $('statusBadge').querySelector('span:last-child').textContent = label;
    $('statusDetail').textContent = status.me ? `Número ${status.me} · ${status.team}` : status.team;
    $('uptime').textContent = `${formatDuration(status.uptimeSec)} · versión ${status.version}`;

    if (status.qr) {
      $('qr').src = status.qr;
      $('qr').hidden = false;
      $('qrEmpty').hidden = true;
    } else {
      $('qr').removeAttribute('src');
      $('qr').hidden = true;
      $('qrEmpty').hidden = false;
      $('qrEmpty').textContent = status.whatsapp === 'open' ? 'El dispositivo ya está vinculado.' : 'No hay un QR pendiente.';
    }
    if (status.pairingCode) {
      $('pairCode').textContent = status.pairingCode;
      $('pairCode').hidden = false;
    } else {
      $('pairCode').hidden = true;
    }
  } catch (error) {
    $('statusBadge').className = 'status-badge bad';
    $('statusBadge').querySelector('span:last-child').textContent = 'Sin conexión';
    $('statusDetail').textContent = error.message;
  }
}

async function requestPairingCode() {
  $('pairError').hidden = true;
  $('pairCode').hidden = true;
  $('pair').disabled = true;
  try {
    const result = await api('/api/pair', {
      method: 'POST',
      body: JSON.stringify({ phone: $('phone').value }),
    });
    $('pairCode').textContent = result.code;
    $('pairCode').hidden = false;
  } catch (error) {
    $('pairError').textContent = error.message;
    $('pairError').hidden = false;
  } finally {
    $('pair').disabled = false;
  }
}

async function requestLogout() {
  if (!confirm('¿Cerrar la sesión de WhatsApp? Tendrás que volver a vincular el bot. Esta acción está disponible para cualquiera que visite el panel público.')) return;
  $('logout').disabled = true;
  try {
    await api('/api/logout', { method: 'POST' });
    await refreshStatus();
  } catch (error) {
    alert(error.message);
  } finally {
    $('logout').disabled = false;
  }
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1]);
    reader.onerror = () => reject(new Error('No se pudo leer la imagen.'));
    reader.readAsDataURL(file);
  });
}

async function refreshBanner() {
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
  message.textContent = text;
  message.className = `form-message ${isError ? 'error' : 'muted'}`;
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
  state.textContent = 'Guardando…';
  try {
    const result = await api('/api/commands', { method: 'PUT', body: JSON.stringify(next) });
    commandSettings = result.settings;
    commandInventory = result.commands;
    $('commandDecoration').value = commandSettings.commandDecoration;
    renderCommands();
    state.textContent = successMessage;
    state.classList.remove('error');
    await refreshMenuPreview();
    window.setTimeout(() => { if (state.textContent === successMessage) state.textContent = ''; }, 2600);
    return true;
  } catch (error) {
    state.textContent = error.message;
    state.classList.add('error');
    window.setTimeout(() => state.classList.remove('error'), 2500);
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

function renderCommands() {
  const list = $('commandList');
  const query = $('commandSearch').value.trim().toLowerCase();
  const visibleCommands = commandInventory.filter((command) => {
    const searchable = `${command.name} ${command.category} ${command.description} ${command.aliases.join(' ')}`.toLowerCase();
    return searchable.includes(query);
  });
  const implementedCount = commandInventory.filter((command) => command.implemented).length;
  const pendingCount = commandInventory.length - implementedCount;
  $('commandCount').textContent = `${implementedCount} listos · ${pendingCount} pendientes`;
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
  try {
    const result = await api('/api/commands');
    commandSettings = result.settings;
    commandInventory = result.commands;
    $('commandDecoration').value = commandSettings.commandDecoration;
    renderCommands();
  } catch (error) {
    $('commandList').replaceChildren(makeElement('p', 'empty-state error', `No se pudieron cargar los comandos: ${error.message}`));
  }
}

async function refreshMenuPreview() {
  try {
    const result = await api('/api/menu');
    $('menuPreview').textContent = result.text;
  } catch (error) {
    $('menuPreview').textContent = `No se pudo cargar la vista previa: ${error.message}`;
  }
}

function startLogs() {
  eventSource?.close();
  eventSource = new EventSource('/api/logs/stream');
  eventSource.onmessage = (event) => {
    try {
      const entry = JSON.parse(event.data);
      const line = makeElement('div', `lvl-${entry.level}`, `${entry.time.slice(11, 19)} ${entry.level.toUpperCase().padEnd(5)} [${entry.scope}] ${entry.message}`);
      const box = $('console');
      box.append(line);
      while (box.childElementCount > 500) box.firstElementChild.remove();
      if ($('autoscroll').checked) box.scrollTop = box.scrollHeight;
    } catch { /* ignora eventos malformados */ }
  };
  eventSource.onerror = () => {
    // EventSource reconecta automáticamente; no es un error de configuración del usuario.
  };
}

async function init() {
  initTheme();
  $('pair').addEventListener('click', requestPairingCode);
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

  await Promise.all([refreshStatus(), refreshBanner(), loadCommands(), refreshMenuPreview()]);
  startLogs();
  statusTimer = window.setInterval(refreshStatus, 5000);
}

window.addEventListener('beforeunload', () => {
  clearInterval(statusTimer);
  eventSource?.close();
});

init();
