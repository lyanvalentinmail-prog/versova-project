/**
 * VÉRSOVA · interfaz web (una sola app para tres rutas):
 *   /        landing  (data-page="landing")
 *   /home    panel    (data-page="home")
 *   /cmds    catálogo (data-page="cmds")
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
  toastTimer = window.setTimeout(() => box.classList.remove('show'), 2400);
}

async function api(path, options = {}) {
  const headers = { Accept: 'application/json', ...(options.headers ?? {}) };
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  const response = await fetch(path, { cache: 'no-store', ...options, headers });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error ?? `Error ${response.status}`);
  return data;
}

async function apiOrNull(path, options) {
  try { return await api(path, options); } catch { return null; }
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
  toggle?.setAttribute('aria-pressed', String(selected === 'dark'));
  toggle?.setAttribute('aria-label', selected === 'light' ? 'Activar modo oscuro' : 'Activar modo claro');
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', selected === 'dark' ? '#05060f' : '#f4f4fb');
  try { localStorage.setItem('versova.theme', selected); } catch { /* opcional */ }
}
function initTheme() {
  let saved = null;
  try { saved = localStorage.getItem('versova.theme'); } catch { /* opcional */ }
  applyTheme(saved || 'dark');
  $('themeToggle')?.addEventListener('click', () =>
    applyTheme(document.documentElement.dataset.theme === 'light' ? 'dark' : 'light'));
}

/* ------------------------------ estado -------------------------------- */
const BADGE = {
  open: ['En línea', 'open'], qr: ['Esperando vinculación', ''],
  connecting: ['Conectando…', ''], closed: ['Reconectando', 'bad'],
  logged_out: ['Sesión cerrada', 'bad'], idle: ['Iniciando', ''],
};
let lastStatus = {};
const setBadge = (id, label, cls) => {
  const badge = $(id); if (!badge) return;
  badge.className = `status-badge ${cls}`.trim();
  const inner = badge.querySelector('span:last-child'); if (inner) inner.textContent = label;
};
const setPill = (id, label, cls) => {
  const pill = $(id); if (!pill) return;
  pill.className = `pill ${cls}`.trim();
  const inner = pill.querySelector('span:last-child'); if (inner) inner.textContent = label;
};
function paintStatus(status) {
  lastStatus = status ?? {};
  const [label, cls] = BADGE[lastStatus.whatsapp] ?? [lastStatus.whatsapp ?? 'Desconocido', 'bad'];
  const pillClass = cls === 'open' ? 'ok' : cls === 'bad' ? 'bad' : '';
  for (const id of ['statusBadge', 'sideBadge', 'botBadge']) setBadge(id, label, cls);
  for (const id of ['statusPill', 'heroStatusPill', 'heroPill', 'navStatus']) {
    setPill(id, label, pillClass);
    $(id)?.querySelector('.live-dot')?.classList.toggle('off', cls !== 'open');
  }
  setText('sideDetail', lastStatus.me ? `Número ${lastStatus.me}` : lastStatus.team ?? 'Buscando estado…');
  setText('statusDetail', lastStatus.me ? `Número ${lastStatus.me} · ${lastStatus.team}` : (lastStatus.team ?? 'Buscando estado…'));
  setText('uptime', `${formatDuration(lastStatus.uptimeSec)} · versión ${lastStatus.version ?? '—'}`);
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
    const badge = $('statusBadge'); if (badge) { badge.className = 'status-badge bad'; badge.querySelector('span:last-child').textContent = 'Sin conexión'; }
    setText('statusDetail', error.message);
    const pill = $('statusPill'); if (pill) { pill.className = 'pill bad'; pill.querySelector('span:last-child').textContent = 'Sin conexión'; }
  }
}

function renderQr(status) {
  const image = $('qr'); const empty = $('qrEmpty');
  if (!image || !empty) return;
  if (status.qr) {
    image.src = status.qr; image.hidden = false; empty.hidden = true;
  } else {
    image.removeAttribute('src'); image.hidden = true; empty.hidden = false;
    empty.textContent = status.whatsapp === 'open' ? 'El dispositivo ya está vinculado.' : 'El QR aparecerá aquí cuando elijas escanear.';
  }
}

/* ---------------------------- emparejamiento --------------------------- */
let pairingCode = null;
let pairingExpiresAt = null;
let pairingTicker = null;
let pairingBusy = false;

function stopPairingTicker() {
  if (pairingTicker) { window.clearInterval(pairingTicker); pairingTicker = null; }
}
function renderPairingCode() {
  const now = Date.now();
  const active = Boolean(pairingCode && pairingExpiresAt && pairingExpiresAt > now);
  const pc = $('pairCode'); const cd = $('pairCountdown');
  if (!pc || !cd) return;
  pc.hidden = !active; cd.hidden = !active;
  if (active) {
    pc.textContent = pairingCode;
    const left = Math.ceil((pairingExpiresAt - now) / 1000);
    cd.textContent = `Expira en ${left} s · WhatsApp → Ajustes → Dispositivos vinculados → Vincular con el número de teléfono`;
  } else {
    stopPairingTicker();
    if (pairingCode) {
      pairingCode = null; pairingExpiresAt = null;
      if (!pairingBusy) {
        const err = $('pairError');
        if (err) { err.textContent = 'El código expiró antes de usarse. Pide uno nuevo e ingrésalo enseguida.'; err.hidden = false; }
      }
    }
    return;
  }
  if (!pairingTicker) pairingTicker = window.setInterval(renderPairingCode, 1000);
}
function renderPairingControls(status) {
  if (!status) return;
  const linked = Boolean(status.linked);
  const ready = Boolean(status.pairingReady);
  const hint = $('pairHint'); if (!hint) return;
  if (linked) hint.textContent = 'El bot ya está vinculado. Cierra la sesión para vincular otro número.';
  else if (!ready) hint.textContent = 'Esperando a que la conexión entre en modo vinculación (ocurre al pedir el código o al mostrar el QR).';
  hint.hidden = linked || ready;
  const pairBtn = $('pair');
  if (pairBtn && !pairingBusy) pairBtn.disabled = linked || !ready;
}
async function requestPairingCode() {
  const errEl = $('pairError'); if (errEl) { errEl.hidden = true; }
  const pc = $('pairCode'); const cd = $('pairCountdown');
  if (pc) pc.hidden = true; if (cd) cd.hidden = true;
  pairingCode = null; pairingExpiresAt = null; stopPairingTicker();
  pairingBusy = true;
  const pairBtn = $('pair');
  if (pairBtn) { pairBtn.disabled = true; pairBtn.textContent = 'Pidiendo…'; }
  try {
    const result = await api('/api/pair', { method: 'POST', body: JSON.stringify({ phone: $('phone')?.value ?? '' }) });
    pairingCode = result.code;
    pairingExpiresAt = result.expiresAt ?? Date.now() + 60_000;
  } catch (error) {
    if (errEl) { errEl.textContent = error.message; errEl.hidden = false; }
  } finally {
    pairingBusy = false;
    if (pairBtn) { pairBtn.disabled = false; pairBtn.textContent = 'Pedir código'; }
    renderPairingCode();
  }
}
async function requestLogout() {
  if (!confirm('¿Cerrar la sesión de WhatsApp? Tendrás que volver a vincular el bot.')) return;
  try {
    await api('/api/logout', { method: 'POST' });
    await refreshStatus(); toast('Sesión cerrada.');
  } catch (error) { alert(error.message); }
}
function copyText(value, message = 'Copiado.') {
  if (typeof navigator === 'undefined' || !navigator.clipboard) { toast(value); return; }
  navigator.clipboard.writeText(value).then(() => toast(message)).catch(() => toast(value));
}

/* ------------------------- sesión del usuario web ------------------------- */
let me = null;
let authConfig = { googleEnabled: false, demoLogin: true };
function goTo(path) { if (typeof location !== 'undefined') location.href = path; }
function handleAuthError(error) {
  if (error && typeof error.message === 'string' && error.message.includes('iniciar sesión')) {
    goTo('/?login=1'); return true;
  }
  return false;
}
async function refreshMe() {
  const data = await apiOrNull('/api/auth/me');
  me = data?.user ?? null;
  authConfig = { googleEnabled: Boolean(data?.googleEnabled), demoLogin: data?.demoLogin !== false };
  return me;
}
function initialsOf(name) {
  const parts = String(name ?? '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'V';
  return parts.slice(0, 2).map((p) => p[0].toUpperCase()).join('');
}
function planClass(plan) { return plan === 'vip' ? 'tier-vip' : plan === 'premium' ? 'tier-premium' : ''; }

function renderAuthArea() {
  const area = $('authArea'); if (!area) return;
  area.replaceChildren();
  if (!me) {
    const login = makeElement('button', 'btn btn-sm btn-ghost', 'Iniciar sesión');
    login.type = 'button'; login.addEventListener('click', () => openAuthModal('login'));
    const register = makeElement('button', 'btn btn-sm btn-primary', 'Crear cuenta');
    register.type = 'button'; register.addEventListener('click', () => openAuthModal('register'));
    area.append(login, register); return;
  }
  const chip = makeElement('div', 'user-chip');
  const btn = makeElement('button', 'chip-btn'); btn.type = 'button';
  btn.setAttribute('aria-haspopup', 'true'); btn.setAttribute('aria-expanded', 'false');
  const av = makeElement('span', 'user-avatar', initialsOf(me.name));
  if (me.picture) { const img = document.createElement('img'); img.src = me.picture; img.alt = ''; av.replaceChildren(img); }
  btn.append(av, makeElement('span', '', me.name.split(' ')[0]), makeElement('span', `tier-badge ${planClass(me.plan)}`, me.planInfo?.name ?? me.plan));
  const menu = makeElement('div', 'chip-menu');
  const head = makeElement('div', 'chip-head');
  head.append(makeElement('b', '', me.name), makeElement('span', '', me.email)); menu.append(head);
  const panelLink = makeElement('a', '', '⌂ Ir al panel'); panelLink.href = '/home';
  const storeLink = makeElement('a', '', '⛶ Tienda'); storeLink.href = '/store';
  const subLink = makeElement('a', '', '◈ Mis Sub-Bots'); subLink.href = '/home#subbots';
  const logoutBtn = makeElement('button', 'danger', '⏻ Cerrar sesión');
  logoutBtn.type = 'button'; logoutBtn.addEventListener('click', () => void doLogout());
  menu.append(panelLink, storeLink, subLink, logoutBtn);
  btn.addEventListener('click', (event) => {
    event.stopPropagation();
    const open = menu.classList.toggle('open'); btn.setAttribute('aria-expanded', String(open));
  });
  if (typeof document !== 'undefined') document.addEventListener('click', () => menu.classList.remove('open'));
  chip.append(btn, menu); area.append(chip);
}
async function doLogout() {
  try {
    await api('/api/auth/logout', { method: 'POST' }); me = null; toast('Sesión cerrada.');
    window.setTimeout(() => goTo('/'), 400);
  } catch (error) { toast(error.message); }
}

/* --------------------- modal de inicio de sesión (portada) ---------------- */
function authModalElements() {
  return { overlay: $('authOverlay'), form: $('authForm'), title: $('authTitle'), submit: $('authSubmit'),
    nameField: $('authNameField'), error: $('authError'), googleButton: $('googleButton'), googleNote: $('googleNote'),
    tabLogin: $('authTabLogin'), tabRegister: $('authTabRegister'), close: $('authClose') };
}
let authTab = 'login';
function setAuthTab(tab) {
  authTab = tab === 'register' ? 'register' : 'login';
  const e = authModalElements(); if (!e.tabLogin) return;
  const isRegister = authTab === 'register';
  e.tabLogin.classList.toggle('is-active', !isRegister); e.tabRegister.classList.toggle('is-active', isRegister);
  e.tabLogin.setAttribute('aria-selected', String(!isRegister)); e.tabRegister.setAttribute('aria-selected', String(isRegister));
  if (e.nameField) e.nameField.hidden = !isRegister;
  if (e.title) e.title.textContent = isRegister ? 'Crea tu cuenta' : 'Bienvenido';
  if (e.submit) e.submit.textContent = isRegister ? 'Crear cuenta gratis' : 'Iniciar sesión';
  if (e.form) e.form.autocomplete = isRegister ? 'new-password' : 'current-password';
  const pwd = $('authPassword'); if (pwd) pwd.setAttribute('autocomplete', isRegister ? 'new-password' : 'current-password');
  if (e.error) e.error.hidden = true;
}
function openAuthModal(tab = 'login') {
  const e = authModalElements(); if (!e.overlay) return; setAuthTab(tab);
  e.overlay.classList.add('is-open'); e.overlay.setAttribute('aria-hidden', 'false');
  window.setTimeout(() => $('authEmail')?.focus(), 120);
}
function closeAuthModal() {
  const e = authModalElements(); if (!e.overlay) return;
  e.overlay.classList.remove('is-open'); e.overlay.setAttribute('aria-hidden', 'true');
}
function paintAuthConfig() {
  const e = authModalElements(); if (!e.googleButton) return;
  if (authConfig.googleEnabled) {
    e.googleButton.disabled = false;
    if (e.googleNote) e.googleNote.textContent = 'Abrimos Google para confirmar tu identidad y volver al panel.';
  } else {
    e.googleButton.disabled = true; e.googleButton.title = 'Configura GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET en el servidor.';
    if (e.googleNote) e.googleNote.textContent = 'Google no está configurado: usa email y contraseña.';
  }
}
async function submitAuthForm(event) {
  event.preventDefault(); const e = authModalElements(); if (!e.form) return;
  const email = ($('authEmail')?.value ?? '').trim(); const password = $('authPassword')?.value ?? '';
  const name = ($('authName')?.value ?? '').trim(); const error = e.error;
  const fail = (m) => { if (error) { error.textContent = m; error.hidden = false; } };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail('Escribe un email válido.');
  if (password.length < 6) return fail('La contraseña necesita al menos 6 caracteres.');
  if (!authConfig.demoLogin) return fail('El acceso con email está desactivado: usa Google.');
  const isRegister = authTab === 'register';
  e.submit.disabled = true; e.submit.textContent = isRegister ? 'Creando cuenta…' : 'Entrando…';
  try {
    const data = await api(isRegister ? '/api/auth/register' : '/api/auth/login', {
      method: 'POST', body: JSON.stringify(isRegister ? { email, password, name } : { email, password }) });
    me = data.user ?? null;
    toast(isRegister ? `¡Cuenta creada! Hola, ${me?.name ?? ''}` : `Hola de nuevo, ${me?.name ?? ''}`);
    const params = new URLSearchParams(typeof location !== 'undefined' ? location.search : '');
    const next = params.get('next');
    window.setTimeout(() => goTo(next === 'store' ? '/store' : '/home'), 500);
  } catch (err) { fail(err.message); e.submit.disabled = false; e.submit.textContent = isRegister ? 'Crear cuenta gratis' : 'Iniciar sesión'; }
}
function initAuthModal() {
  const e = authModalElements(); if (!e.overlay) return;
  e.tabLogin?.addEventListener('click', () => setAuthTab('login'));
  e.tabRegister?.addEventListener('click', () => setAuthTab('register'));
  e.close?.addEventListener('click', closeAuthModal);
  e.form?.addEventListener('submit', (ev) => void submitAuthForm(ev));
  e.overlay.addEventListener('click', (ev) => { if (ev.target === e.overlay) closeAuthModal(); });
  e.googleButton?.addEventListener('click', () => { if (authConfig.googleEnabled) goTo('/api/auth/google/start'); });
  setAuthTab('login'); paintAuthConfig();
}
function initLoginRedirect() {
  if (typeof location === 'undefined') return;
  const params = new URLSearchParams(location.search);
  if (params.get('login') === '1') openAuthModal(params.get('mode') === 'register' ? 'register' : 'login');
  const error = params.get('error');
  if (error) window.setTimeout(() => toast(error), 350);
}

/* ------------------------ menú de 3 líneas ------------------------- */
function setMenuOpen(open) {
  const toggle = $('menuToggle'); const overlay = $('menuOverlay'); const close = $('menuClose');
  if (toggle) { toggle.classList.toggle('is-open', open); toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú'); }
  if (overlay) { overlay.classList.toggle('is-open', open); overlay.setAttribute('aria-hidden', String(!open)); }
  if (close) close.style.display = open ? '' : 'none';
  if (typeof document !== 'undefined' && document.body) document.body.style.overflow = open ? 'hidden' : '';
}
function closeMenus() {
  setMenuOpen(false);
  if (typeof document !== 'undefined' && document.body) document.body.classList.remove('nav-open');
  const toggle = $('menuToggle'); if (toggle) toggle.setAttribute('aria-expanded', 'false');
}
function initMenuOverlay() {
  const toggle = $('menuToggle'); const overlay = $('menuOverlay');
  if (!toggle || !overlay) return;
  toggle.addEventListener('click', () => setMenuOpen(!overlay.classList.contains('is-open')));
  overlay.addEventListener('click', (ev) => { if (ev.target === overlay) setMenuOpen(false); });
  $('menuClose')?.addEventListener('click', () => setMenuOpen(false));
  for (const link of overlay.querySelectorAll('a')) link.addEventListener('click', () => setMenuOpen(false));
  if (typeof document !== 'undefined') document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape') closeMenus(); });
}
function initSidebarDrawer() {
  const toggle = $('menuToggle'); if (!toggle) return;
  toggle.addEventListener('click', () => {
    const open = document.body.classList.toggle('nav-open');
    toggle.classList.toggle('is-open', open);
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Cerrar pestañas' : 'Abrir pestañas');
  });
  $('navBackdrop')?.addEventListener('click', closeMenus);
  for (const link of document.querySelectorAll('.sidebar [data-view], .sidebar a[href]')) link.addEventListener('click', () => closeMenus());
  if (typeof document !== 'undefined') document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape') closeMenus(); });
}

/* ------------------------- animación al hacer scroll ---------------------- */
function initReveal() {
  if (typeof IntersectionObserver !== 'function' || typeof document === 'undefined') return;
  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) { if (entry.isIntersecting) { entry.target.classList.add('is-visible'); observer.unobserve(entry.target); } }
  }, { threshold: 0.12 });
  for (const section of document.querySelectorAll('.section, .stats-strip, .cta-band')) { section.classList.add('reveal'); observer.observe(section); }
}

function makeElement(tag, className, text) {
  const el = document.createElement(tag); if (className) el.className = className;
  if (text !== undefined) el.textContent = text; return el;
}

/* ------------------------------- comandos ------------------------------ */
let commandSettings = null;
let commandInventory = [];
let commandCategory = 'Todos';

function updateSet(list, name, shouldContain) { const s = new Set(list); if (shouldContain) s.add(name); else s.delete(name); return [...s]; }
function cloneSettings(s) {
  return { ...s, disabled: [...s.disabled], hidden: [...s.hidden],
    aliases: Object.fromEntries(Object.entries(s.aliases).map(([n, v]) => [n, [...v]])) };
}
async function saveCommandConfiguration(next, msg = 'Guardado.') {
  const state = $('commandSaveState');
  if (state) state.textContent = 'Guardando…';
  try {
    const result = await api('/api/commands', { method: 'PUT', body: JSON.stringify(next) });
    commandSettings = result.settings; commandInventory = result.commands;
    $('commandDecoration').value = commandSettings.commandDecoration; renderCommands();
    if (state) state.textContent = msg; await refreshMenuPreview();
    window.setTimeout(() => { if (state && state.textContent === msg) state.textContent = ''; }, 2600);
    return true;
  } catch (error) {
    if (state) state.textContent = error.message;
    window.setTimeout(() => { if (state) state.textContent = ''; }, 3200);
    return false;
  }
}
function renderAliasList(command) {
  const wrap = makeElement('div', 'command-aliases');
  const aliases = commandSettings.aliases[command.name] ?? [];
  for (const a of aliases) {
    const chip = makeElement('span', 'alias-chip', `.${a}`);
    const rm = makeElement('button', 'alias-remove', '×'); rm.type = 'button'; rm.title = `Eliminar alias .${a}`;
    rm.addEventListener('click', async () => {
      const next = cloneSettings(commandSettings);
      next.aliases[command.name] = next.aliases[command.name].filter((i) => i !== a);
      if (!next.aliases[command.name].length) delete next.aliases[command.name];
      await saveCommandConfiguration(next, `Alias .${a} eliminado.`);
    });
    chip.append(rm); wrap.append(chip);
  }
  if (command.implemented) {
    const form = makeElement('form', 'alias-form');
    const input = makeElement('input'); input.type = 'text'; input.maxLength = 25; input.placeholder = 'nuevo alias'; input.autocomplete = 'off';
    const add = makeElement('button', '', '＋ Alias'); add.type = 'submit'; form.append(input, add);
    form.addEventListener('submit', async (ev) => {
      ev.preventDefault(); const alias = input.value.trim().replace(/^\./, '').toLowerCase(); if (!alias) return;
      const next = cloneSettings(commandSettings); const vals = next.aliases[command.name] ?? [];
      if (vals.includes(alias)) { input.setCustomValidity('Ese alias ya existe.'); input.reportValidity(); return; }
      next.aliases[command.name] = [...vals, alias]; const ok = await saveCommandConfiguration(next, `Alias .${alias} creado.`);
      if (!ok) input.focus();
    });
    wrap.append(form);
  }
  return wrap;
}
function makeCommandControl(command, kind) {
  const label = makeElement('label', 'command-control');
  const input = makeElement('input'); input.type = 'checkbox';
  input.checked = kind === 'enabled' ? command.enabled : command.visible;
  label.append(input, makeElement('span', 'control-switch'), makeElement('span', '', kind === 'enabled' ? 'Activo' : 'En menú'));
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
  const removed = command.implemented ? (!command.enabled || !command.visible) : !command.visible;
  if (removed) {
    next.hidden = updateSet(next.hidden, command.name, false);
    next.disabled = updateSet(next.disabled, command.name, false);
    await saveCommandConfiguration(next, `.${command.name} restaurado.`);
  } else {
    next.hidden = updateSet(next.hidden, command.name, true);
    if (command.implemented) next.disabled = updateSet(next.disabled, command.name, true);
    await saveCommandConfiguration(next, `.${command.name} eliminado del menú.`);
  }
}
function renderCategoryChips() {
  const box = $('commandCategories'); if (!box || !commandInventory.length) return;
  const counts = new Map(); for (const c of commandInventory) counts.set(c.category, (counts.get(c.category) ?? 0) + 1);
  const cats = ['Todos', ...[...counts.keys()].sort()]; box.replaceChildren();
  for (const cat of cats) {
    const chip = makeElement('button', `chip${commandCategory === cat ? ' is-active' : ''}`); chip.type = 'button';
    chip.append(makeElement('span', '', cat), makeElement('b', '', cat === 'Todos' ? commandInventory.length : counts.get(cat)));
    chip.addEventListener('click', () => { commandCategory = cat; renderCategoryChips(); renderCommands(); });
    box.append(chip);
  }
}
function renderCommands() {
  const list = $('commandList'); if (!list) return;
  const q = ($('commandSearch')?.value ?? '').trim().toLowerCase();
  const visible = commandInventory.filter((c) => {
    const s = `${c.name} ${c.category} ${c.description} ${c.aliases.join(' ')}`.toLowerCase();
    return (commandCategory === 'Todos' || c.category === commandCategory) && s.includes(q);
  });
  const done = commandInventory.filter((c) => c.implemented).length;
  const pend = commandInventory.length - done;
  $('commandCount').textContent = `${done} listos · ${pend} pendientes`;
  setText('navCommandCount', done);
  list.replaceChildren();
  if (!visible.length) { list.append(makeElement('p', 'empty-state', 'No se encontraron comandos.')); return; }
  for (const cmd of visible) {
    const row = makeElement('article', `command-row${cmd.enabled ? '' : ' is-disabled'}`);
    const main = makeElement('div', 'command-main');
    const title = makeElement('div', 'command-title-line');
    title.append(makeElement('span', 'command-name', `.${cmd.name}`));
    if (cmd.usage !== `.${cmd.name}`) title.append(makeElement('span', 'command-usage', cmd.usage));
    title.append(makeElement('span', 'command-category', cmd.category));
    title.append(makeElement('span', `command-state${cmd.implemented ? '' : ' pending'}`, cmd.implemented ? 'Disponible' : 'Pendiente'));
    main.append(title, makeElement('p', 'command-description', cmd.description), renderAliasList(cmd));
    const controls = makeElement('div', 'command-controls');
    if (cmd.implemented) controls.append(makeCommandControl(cmd, 'enabled'));
    if (cmd.inTemplate) controls.append(makeCommandControl(cmd, 'visible'));
    if (cmd.inTemplate) {
      const removed = cmd.implemented ? (!cmd.enabled || !cmd.visible) : !cmd.visible;
      const rm = makeElement('button', `remove-command${removed ? ' restore' : ''}`, removed ? 'Restaurar' : cmd.implemented ? 'Eliminar' : 'Ocultar');
      rm.type = 'button'; rm.addEventListener('click', () => removeOrRestoreCommand(cmd)); controls.append(rm);
    }
    row.append(main, controls); list.append(row);
  }
}
async function loadCommands() {
  const list = $('commandList'); if (!list) return;
  try {
    const res = await api('/api/commands'); commandSettings = res.settings; commandInventory = res.commands;
    $('commandDecoration').value = commandSettings.commandDecoration; renderCategoryChips(); renderCommands();
  } catch (error) { list.replaceChildren(makeElement('p', 'empty-state error', `No se pudieron cargar los comandos: ${error.message}`)); }
}
async function refreshMenuPreview() {
  const preview = $('menuPreview'); if (!preview) return;
  try { const r = await api('/api/menu'); preview.textContent = r.text; }
  catch (error) { preview.textContent = `No se pudo cargar la vista previa: ${error.message}`; }
}

/* --------------------------------- logs -------------------------------- */
let eventSource = null;
function startLogs() {
  const box = $('console'); if (!box || typeof EventSource !== 'function') return;
  eventSource?.close(); eventSource = new EventSource('/api/logs/stream');
  eventSource.onmessage = (ev) => {
    try {
      const entry = JSON.parse(ev.data);
      const line = makeElement('div', `lvl-${entry.level}`, `${String(entry.time).slice(11, 19)} ${String(entry.level).toUpperCase().padEnd(5)} [${entry.scope}] ${entry.message}`);
      box.append(line);
      while (box.childElementCount > 500) box.firstElementChild.remove();
      if ($('autoscroll').checked) box.scrollTop = box.scrollHeight;
    } catch { /* ignorar */ }
  };
  eventSource.onerror = () => { /* reconecta solo */ };
}

/* ------------------------------ telemetría ----------------------------- */
async function refreshSystem() {
  const data = await apiOrNull('/api/system');
  const pill = $('monitorPill');
  if (!data) { if (pill) { pill.className = 'pill bad'; pill.querySelector('span:last-child').textContent = 'sin datos'; } return; }
  if (pill) { pill.className = 'pill ok'; pill.querySelector('span:last-child').textContent = `medido ${new Date(data.time).toLocaleTimeString('es-UY')}`; }
  const cpu = Number(data.cpuPercent) || 0; setText('cpuValue', `${cpu.toFixed(1)} %`); setWidth('cpuBar', cpu);
  setText('cpuNote', `${data.cpuCores ?? '—'} núcleos · carga ${Array.isArray(data.loadAvg) ? data.loadAvg.join(' / ') : '—'}`);
  const mem = data.memory ?? {}; setText('ramValue', `${Number(mem.usedPercent ?? 0).toFixed(1)} %`); setWidth('ramBar', mem.usedPercent);
  setText('ramNote', `Usado ${mem.usedGb ?? '—'} GB · Total ${mem.totalGb ?? '—'} GB · Libre ${mem.freeGb ?? '—'} GB`);
  if (data.disk) { setText('diskValue', `${Number(data.disk.usedPercent).toFixed(1)} %`); setWidth('diskBar', data.disk.usedPercent);
    setText('diskNote', `Usado ${data.disk.usedGb} GB · Total ${data.disk.totalGb} GB · Libre ${data.disk.freeGb} GB`); }
  else { setText('diskValue', 'sin datos'); setWidth('diskBar', 0); setText('diskNote', 'Sin métricas de disco.'); }
  const lat = data.dbLatencyMs; const lpct = lat == null ? 0 : Math.max(6, Math.min(100, 100 - lat));
  setText('netValue', lat == null ? 'sin respuesta' : `${lat} ms`); setWidth('netBar', lpct);
  setText('netNote', lat == null ? 'BD sin responder.' : `Latencia PostgreSQL · ${lastStatus.whatsapp === 'open' ? 'WA en línea' : 'WA pendiente'}`);
  setText('sysHost', data.hostname); setText('sysPid', data.pid); setText('sysNode', data.node);
  setText('sysPlatform', `${data.platform ?? '—'} · ${data.arch ?? ''}`);
  setText('sysCpuModel', `${data.cpuModel ?? '—'}${data.cpuSpeedMhz ? ` @ ${data.cpuSpeedMhz} MHz` : ''}`);
  setText('sysLoad', Array.isArray(data.loadAvg) ? data.loadAvg.join(' / ') : '—');
  setText('sysUptime', formatDuration(data.systemUptimeSec)); setText('sysTime', formatDate(data.time));
  setText('heroDb', lat == null ? 'sin respuesta' : `ok · ${lat} ms`);
}
async function refreshMetrics() {
  const data = await apiOrNull('/api/metrics'); const m = data?.metrics;
  if (!m) { setText('botGroups', 'sin datos'); setText('heroDb', 'sin datos'); return; }
  countUp('statUsers', m.users); countUp('statCharacters', m.characters); countUp('statGroups', m.groups);
  countUp('statMembers', m.members); countUp('statRequests', m.pendingRequests); countUp('statWarns', m.warnings);
  setText('statCharactersNote', `${number(m.charactersOccupied)} ocupados`);
  setText('statMembersNote', `${number(m.activeMembers)} activos en 7 días`);
  setText('botGroups', number(m.groups)); setText('botUsers', number(m.users));
  setText('botCharacters', `${number(m.charactersOccupied)} / ${number(m.characters)}`);
  setText('botActivity', formatDate(m.lastActivityAt));
  setText('cardGroups', number(m.groups)); setText('cardActive', number(m.activeMembers)); setText('cardActions', number(m.actions));
  setText('monGroups', number(m.groups)); setText('monMembers', number(m.members)); setText('monUsers', number(m.users));
  setText('monCharacters', `${number(m.charactersOccupied)} / ${number(m.characters)}`);
  setText('monRequests', number(m.pendingRequests)); setText('monWarns', number(m.warnings));
  setText('monActions', number(m.actions)); setText('monLastActivity', formatDate(m.lastActivityAt));
}

/* ------------------------------- sub-bots -------------------------------- */
let subbotData = null;
let subbotEditingId = null;
let subbotTier = 'free';
let subbotBotType = 'versova';
let editorTab = 'general';

const TIER_BADGE = { free: '', premium: 'tier-premium', vip: 'tier-vip' };
function tierInfo(tier) {
  const tiers = subbotData?.tiers ?? {};
  return tiers[tier] ?? { name: tier, spaceGb: tier === 'vip' ? 4 : tier === 'premium' ? 2 : 1 };
}
function botTypeInfo(id) {
  return (subbotData?.botTypes ?? []).find((bt) => bt.id === id) ?? { id, name: id, description: '' };
}

function renderSubBots() {
  const list = $('subbotList'); if (!list || !subbotData) return;
  const bots = subbotData.bots ?? []; const plan = subbotData.plan ?? {};
  const usage = subbotData.usage ?? {}; const tokens = subbotData.tokens ?? [];
  setText('navSubbotCount', `${number(usage.botsUsed ?? 0)}`);
  setText('quotaBots', `${number(usage.botsUsed ?? 0)} / ${number(usage.botsMax ?? 0)}`);
  setText('quotaPlan', `${plan.name ?? '—'} · ${plan.spacePerBotGb ?? '—'} GB por bot · máx ${plan.maxBots ?? '—'}`);
  setText('quotaExtra', `${number(usage.extraSpaceFree ?? 0)} GB`);
  setText('subbotQuota', `${usage.botsUsed ?? 0} / ${usage.botsMax ?? 0} bots`);
  countUp('statSubBots', usage.botsUsed ?? 0);
  setText('statSubBotsNote', `de ${usage.botsMax ?? '—'} permitidos (plan ${plan.name ?? '—'})`);
  setText('statExtraSpace', `${number(usage.extraSpaceGb ?? 0)} GB`);
  setText('statExtraNote', `${number(usage.extraSpaceFree ?? 0)} GB sin asignar`);
  countUp('statTokens', tokens.filter((t) => t.status === 'unused').length);
  setText('statTokensNote', 'tokens listos para canjear');
  setText('statPlan', plan.name ?? '—');
  setText('statPlanNote', `máx ${plan.maxBots ?? '—'} bots · ${plan.spacePerBotGb ?? '—'} GB por bot`);
  const planPill = $('planPill'); if (planPill) planPill.textContent = `Plan ${plan.name ?? '—'}`;
  const cmdCount = commandInventory.filter((c) => c.implemented).length;
  setText('statCommands', cmdCount); setText('statCommandsNote', 'disponibles');
  countUp('heroCount', cmdCount);
  list.replaceChildren();
  if (!bots.length) {
    list.append(makeElement('p', 'empty-state', 'Todavía no tienes sub-bots. Crea el primero con el botón de arriba: el tipo Free no necesita token.'));
    return;
  }
  for (const bot of bots) {
    const card = makeElement('article', 'card inset subbot-card');
    const top = makeElement('div', 'subbot-top');
    const avatarText = bot.display_name || bot.name;
    top.append(makeElement('span', 'subbot-avatar', initialsOf(avatarText)));
    const titleBox = makeElement('div');
    titleBox.append(makeElement('h4', '', bot.display_name || bot.name));
    const status = makeElement('span', `subbot-status ${bot.status}`, bot.status === 'online' ? 'En línea' : bot.status === 'paused' ? 'Pausado' : 'Offline');
    titleBox.append(status);
    if (bot.bot_type && bot.bot_type !== 'versova') {
      titleBox.append(makeElement('span', 'muted small', ` · ${botTypeInfo(bot.bot_type).name}`));
    }
    top.append(titleBox);
    top.append(makeElement('span', `tier-badge ${TIER_BADGE[bot.tier]}`, tierInfo(bot.tier).name));
    card.append(top);
    if (bot.description) card.append(makeElement('p', 'subbot-desc', bot.description));
    const meta = makeElement('div', 'subbot-meta');
    meta.append(makeElement('span', 'pill', `◈ ${botTypeInfo(bot.bot_type).name}`));
    meta.append(makeElement('span', 'pill', `⛁ ${number(bot.totalSpaceGb)} GB`));
    if (bot.bot_prefix && bot.bot_prefix !== '.') meta.append(makeElement('span', 'pill', `prefix ${bot.bot_prefix}`));
    if (bot.extra_gb > 0) meta.append(makeElement('span', 'pill ok', `+${number(bot.extra_gb)} GB extra`));
    if (bot.phone) meta.append(makeElement('span', 'pill', `☎ ${bot.phone}`));
    card.append(meta);
    const actions = makeElement('div', 'row');
    const edit = makeElement('button', 'btn btn-sm btn-primary', 'Editar'); edit.type = 'button';
    edit.addEventListener('click', () => openSubBotModal(bot));
    const activateBtn = makeElement('button', 'btn btn-sm', bot.status === 'online' ? 'Pausar' : '⚡ Activar');
    activateBtn.type = 'button';
    activateBtn.addEventListener('click', () => {
      if (bot.status === 'online') {
        toggleBotStatus(bot);
      } else {
        openActivateModal(bot);
      }
    });
    const remove = makeElement('button', 'btn btn-sm btn-danger', 'Eliminar'); remove.type = 'button';
    remove.addEventListener('click', () => void removeSubBot(bot));
    actions.append(edit, activateBtn, remove);
    card.append(actions); list.append(card);
  }
}

async function toggleBotStatus(bot) {
  try {
    await api(`/api/subbots/${bot.id}`, { method: 'PUT', body: JSON.stringify({ status: bot.status === 'online' ? 'paused' : 'online' }) });
    toast(bot.status === 'online' ? 'Sub-bot pausado.' : 'Sub-bot activado.');
    await loadSubBots();
  } catch (error) { if (!handleAuthError(error)) toast(error.message); }
}

async function loadSubBots() {
  try { subbotData = await api('/api/subbots'); renderSubBots(); }
  catch (error) {
    if (handleAuthError(error)) return;
    const list = $('subbotList');
    if (list) list.replaceChildren(makeElement('p', 'empty-state error', `No se pudieron cargar tus sub-bots: ${error.message}`));
  }
}

async function removeSubBot(bot) {
  if (!confirm(`¿Eliminar el sub-bot «${bot.name}»? Esta acción no se puede deshacer${bot.token_code ? ' y su token queda consumido' : ''}.`)) return;
  try {
    const res = await api(`/api/subbots/${bot.id}`, { method: 'DELETE' });
    toast(res.note ?? 'Sub-bot eliminado.'); await loadSubBots();
  } catch (error) { if (!handleAuthError(error)) toast(error.message); }
}

/* --------- pestañas del editor --------- */
function switchEditorTab(name) {
  editorTab = name;
  for (const tab of document.querySelectorAll('.editor-tab')) {
    tab.classList.toggle('is-active', tab.dataset.editorTab === name);
    tab.setAttribute('aria-selected', String(tab.dataset.editorTab === name));
  }
  for (const pane of document.querySelectorAll('.editor-pane')) {
    pane.classList.toggle('is-active', pane.dataset.editorPane === name);
  }
  const prev = document.querySelector('.editor-prev');
  const next = document.querySelector('.editor-next');
  const submit = $('subbotSubmit');
  const order = ['general', 'identity', 'space'];
  const idx = order.indexOf(name);
  if (prev) { prev.hidden = idx === 0; }
  if (next) { next.hidden = idx === order.length - 1; }
  if (submit) { submit.hidden = idx !== order.length - 1; }
}

function renderBotTypePicker() {
  const picker = $('bottypePicker'); if (!picker) return;
  picker.replaceChildren();
  const types = subbotData?.botTypes ?? [];
  for (const bt of types) {
    const btn = makeElement('button', `bottype-option${bt.id === subbotBotType ? ' is-active' : ''}`);
    btn.type = 'button'; btn.dataset.tier = bt.id;
    if (bt.comingSoon) btn.setAttribute('data-soon', 'true');
    if (bt.recommended) btn.classList.add('recommended');
    const b = makeElement('b', '', bt.name);
    b.prepend(makeElement('span', `bottype-dot${bt.comingSoon ? ' coming' : ''}`));
    btn.append(b);
    btn.append(makeElement('span', '', bt.description));
    if (bt.comingSoon) btn.append(makeElement('span', 'bottype-soon', 'Próximamente'));
    if (bt.recommended && !bt.comingSoon) btn.append(makeElement('span', 'bottype-soon', 'Predeterminado'));
    btn.addEventListener('click', () => {
      if (bt.comingSoon) { toast(`«${bt.name}» estará disponible muy pronto.`); return; }
      subbotBotType = bt.id; renderBotTypePicker();
    });
    picker.append(btn);
  }
}

function paintExtraSlider(bot = null) {
  const wrap = $('extraField'); if (!wrap) return;
  const free = Number(subbotData?.usage?.extraSpaceFree ?? 0); const mine = bot?.extra_gb ?? 0;
  const max = free + mine;
  const slider = $('subbotExtra'); if (!slider) return;
  // Al crear no hay slider (extra_gb se asigna después).
  if (!bot) {
    wrap.hidden = true;
    const summary = $('spaceSummary');
    if (summary) summary.textContent = 'El espacio extra se asigna después de crear el bot, editándolo.';
    return;
  }
  wrap.hidden = false;
  slider.max = String(max); slider.value = String(mine);
  if ($('subbotExtraValue')) $('subbotExtraValue').textContent = `${number(mine)} GB`;
  const hint = $('subbotExtraHint');
  if (hint) hint.textContent = max === 0 ? 'Compra espacio en la tienda para asignarlo aquí.' : `Puedes asignar hasta ${number(max)} GB (pool libre ${number(free)} GB).`;
  const summary = $('spaceSummary');
  if (summary) summary.textContent = `Este bot tiene ${number(bot.totalSpaceGb)} GB (base ${number(bot.baseSpaceGb)} GB${bot.extra_gb ? ` + ${number(bot.extra_gb)} GB extra` : ''}).`;
}

function openSubBotModal(bot = null) {
  const overlay = $('subbotOverlay'); if (!overlay) return;
  subbotEditingId = bot?.id ?? null;
  subbotTier = bot?.tier ?? 'free';
  subbotBotType = bot?.bot_type ?? 'versova';
  if ($('subbotModalTitle')) $('subbotModalTitle').textContent = bot ? `Editar ${bot.name}` : 'Crear sub-bot';
  if ($('subbotSubmit')) $('subbotSubmit').textContent = bot ? 'Guardar cambios' : 'Crear sub-bot';
  if ($('subbotName')) $('subbotName').value = bot?.name ?? '';
  if ($('subbotPhone')) $('subbotPhone').value = bot?.phone ?? '';
  if ($('subbotDescription')) $('subbotDescription').value = bot?.description ?? '';
  if ($('subbotToken')) $('subbotToken').value = bot?.token_code ?? '';
  if ($('subbotDisplayName')) $('subbotDisplayName').value = bot?.display_name ?? '';
  if ($('subbotPrefix')) $('subbotPrefix').value = bot?.bot_prefix ?? '.';
  if ($('subbotBannerText')) $('subbotBannerText').value = bot?.banner_text ?? '';
  if ($('subbotError')) $('subbotError').hidden = true;
  const isCreate = !bot;
  if ($('tierPicker')) {
    for (const opt of $('tierPicker').querySelectorAll('.tier-option')) {
      opt.classList.toggle('is-active', opt.dataset?.tier === subbotTier);
      opt.disabled = !isCreate;
    }
  }
  if ($('tokenField')) $('tokenField').hidden = subbotTier === 'free';
  if ($('tokenHint')) {
    const unused = subbotData?.tokens ?? [];
    $('tokenHint').textContent = unused.length ? `Tienes ${unused.length} token${unused.length === 1 ? '' : 's'} sin usar. Pega el código o pulsa «Usar mío».` : 'No tienes tokens sin usar: cómpralos en la tienda.';
  }
  paintExtraSlider(bot);
  if ($('useLastToken')) $('useLastToken').disabled = !(subbotData?.tokens ?? []).length;
  renderBotTypePicker();
  switchEditorTab('general');
  overlay.classList.add('is-open'); overlay.setAttribute('aria-hidden', 'false');
  window.setTimeout(() => $('subbotName')?.focus(), 120);
}
function closeSubBotModal() {
  const overlay = $('subbotOverlay'); if (!overlay) return;
  overlay.classList.remove('is-open'); overlay.setAttribute('aria-hidden', 'true');
}

function syncTierPicker() {
  if ($('tokenField')) $('tokenField').hidden = subbotTier === 'free';
  if ($('tierPicker')) {
    for (const opt of $('tierPicker').querySelectorAll('.tier-option')) {
      opt.classList.toggle('is-active', opt.dataset?.tier === subbotTier);
    }
  }
}

async function submitSubBot(ev) {
  ev.preventDefault();
  const button = $('subbotSubmit'); const error = $('subbotError');
  const fail = (m) => { if (error) { error.textContent = m; error.hidden = false; } };
  if (error) error.hidden = true;
  const body = {
    name: $('subbotName')?.value ?? '',
    phone: $('subbotPhone')?.value ?? '',
    description: $('subbotDescription')?.value ?? '',
    displayName: $('subbotDisplayName')?.value ?? '',
    botPrefix: $('subbotPrefix')?.value ?? '.',
    bannerText: $('subbotBannerText')?.value ?? '',
    botType: subbotBotType,
  };
  if (button) button.disabled = true;
  try {
    if (subbotEditingId) {
      const slider = $('subbotExtra');
      if (slider && !$('extraField')?.hidden) body.extraGb = Number(slider.value);
      await api(`/api/subbots/${subbotEditingId}`, { method: 'PUT', body: JSON.stringify(body) });
      toast('Sub-bot actualizado.');
    } else {
      body.tier = subbotTier;
      if (subbotTier !== 'free') {
        body.tokenCode = ($('subbotToken')?.value ?? '').trim();
        if (!body.tokenCode) { fail(`Para un sub-bot ${tierInfo(subbotTier).name} necesitas pegar el código de un token.`); return; }
      }
      await api('/api/subbots', { method: 'POST', body: JSON.stringify(body) });
      toast(`Sub-bot «${body.name}» creado.`);
    }
    closeSubBotModal(); await loadSubBots();
  } catch (err) {
    if (!handleAuthError(err)) fail(err.message);
  } finally { if (button) button.disabled = false; }
}

function initSubBots() {
  $('createSubBot')?.addEventListener('click', () => openSubBotModal(null));
  $('subbotClose')?.addEventListener('click', closeSubBotModal);
  const overlay = $('subbotOverlay');
  overlay?.addEventListener('click', (ev) => { if (ev.target === overlay) closeSubBotModal(); });
  $('subbotForm')?.addEventListener('submit', (ev) => void submitSubBot(ev));
  if ($('tierPicker')) {
    for (const opt of $('tierPicker').querySelectorAll('.tier-option')) {
      opt.addEventListener('click', () => {
        if (opt.disabled) return;
        subbotTier = opt.dataset?.tier ?? 'free'; syncTierPicker();
      });
    }
  }
  $('subbotExtra')?.addEventListener('input', (ev) => {
    if ($('subbotExtraValue')) $('subbotExtraValue').textContent = `${number(ev.target.value)} GB`;
  });
  $('useLastToken')?.addEventListener('click', () => {
    const token = (subbotData?.tokens ?? []).find((t) => t.status === 'unused');
    if (token && $('subbotToken')) { $('subbotToken').value = token.code; toast('Token cargado desde tu cuenta.'); }
  });
  for (const tab of document.querySelectorAll('.editor-tab')) {
    tab.addEventListener('click', () => switchEditorTab(tab.dataset.editorTab ?? 'general'));
  }
  document.querySelector('.editor-prev')?.addEventListener('click', () => {
    const order = ['general', 'identity', 'space']; const i = order.indexOf(editorTab);
    if (i > 0) switchEditorTab(order[i - 1]);
  });
  document.querySelector('.editor-next')?.addEventListener('click', () => {
    const order = ['general', 'identity', 'space']; const i = order.indexOf(editorTab);
    if (i < order.length - 1) switchEditorTab(order[i + 1]);
  });
  if (typeof document !== 'undefined') {
    document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape') { closeSubBotModal(); closeActivateModal(); } });
  }
}

/* --------- modal de activación (elige QR o código) --------- */
let activateTargetBot = null;
function openActivateModal(bot = null) {
  activateTargetBot = bot;
  const overlay = $('activateOverlay'); if (!overlay) return;
  if ($('activateBotName')) $('activateBotName').textContent = bot ? (bot.display_name || bot.name) : 'el bot principal';
  // Si el bot tiene un teléfono guardado, rellenarlo
  if ($('phone') && bot?.phone) $('phone').value = bot.phone;
  showActivateStep('method');
  // Limpiar errores anteriores
  const err = $('pairError'); if (err) { err.hidden = true; err.textContent = ''; }
  pairingCode = null; pairingExpiresAt = null; stopPairingTicker();
  const pc = $('pairCode'); const cd = $('pairCountdown');
  if (pc) pc.hidden = true; if (cd) cd.hidden = true;
  overlay.classList.add('is-open'); overlay.setAttribute('aria-hidden', 'false');
}
function closeActivateModal() {
  const overlay = $('activateOverlay'); if (!overlay) return;
  overlay.classList.remove('is-open'); overlay.setAttribute('aria-hidden', 'true');
  stopPairingTicker();
}
function showActivateStep(step) {
  const method = $('activateStepMethod'); const qr = $('activateStepQr'); const code = $('activateStepCode');
  if (method) method.hidden = step !== 'method';
  if (qr) qr.hidden = step !== 'qr';
  if (code) code.hidden = step !== 'code';
  if (step === 'qr') {
    // Forzar regeneración: al abrir esta pestaña se confía en el refreshStatus que traerá el QR
    const empty = $('qrEmpty'); if (empty) empty.textContent = 'Esperando QR…';
    refreshStatus();
  }
}
function initActivateModal() {
  $('activateClose')?.addEventListener('click', closeActivateModal);
  $('activateCancel')?.addEventListener('click', closeActivateModal);
  const overlay = $('activateOverlay');
  overlay?.addEventListener('click', (ev) => { if (ev.target === overlay) closeActivateModal(); });
  for (const card of document.querySelectorAll('.method-card')) {
    card.addEventListener('click', () => {
      const m = card.dataset.method;
      showActivateStep(m);
    });
  }
  $('activateBackFromQr')?.addEventListener('click', () => showActivateStep('method'));
  $('activateBackFromCode')?.addEventListener('click', () => showActivateStep('method'));
  $('activateGlobal')?.addEventListener('click', () => openActivateModal(null));
  $('activateLogout')?.addEventListener('click', () => { if (confirm('¿Cerrar sesión de WhatsApp?')) requestLogout().then(closeActivateModal); });
  $('activateLogout2')?.addEventListener('click', () => { if (confirm('¿Cerrar sesión de WhatsApp?')) requestLogout().then(closeActivateModal); });
}

/* --------------------------------- tienda -------------------------------- */
let storeData = null;
function findStoreItem(id) { return (storeData?.items ?? []).find((i) => i.id === id) ?? null; }
function renderStore() {
  if (!storeData) return;
  const { user, usage, tokens, purchases, plans } = storeData;
  setText('storePlan', plans[user.plan].name);
  setText('storePlanNote', `máx ${plans[user.plan].maxBots} bots · ${plans[user.plan].spacePerBotGb} GB por bot`);
  setText('storeBots', `${number(usage.botsUsed)} / ${number(usage.botsMax)}`);
  setText('storeBotsNote', 'bots de tu plan');
  setText('storeExtra', `${number(usage.extraSpaceFree)} GB`);
  setText('storeExtraNote', `${number(usage.extraSpaceGb)} GB comprados en total`);
  countUp('storeTokensFree', tokens.filter((t) => t.status === 'unused').length);
  setText('storePlanPill', `Plan ${plans[user.plan].name}`);
  setText('poolTotal', `${number(usage.extraSpaceGb)} GB`);
  setText('poolUsed', `${number(usage.extraSpaceGb - usage.extraSpaceFree)} GB`);
  setText('poolFree', `${number(usage.extraSpaceFree)} GB`);
  const planOrder = { free: 0, premium: 1, vip: 2 };
  const rank = planOrder[user.plan] ?? 0;
  for (const card of document.querySelectorAll('.plan-card[data-plan]')) {
    const pid = card.dataset?.plan; const btn = card.querySelector('.buy-button'); if (!btn) continue;
    if (pid === user.plan) { btn.disabled = true; btn.textContent = 'Tu plan actual'; }
    else if ((planOrder[pid] ?? 0) <= rank) { btn.disabled = true; btn.textContent = 'Ya cubierto'; }
    else { btn.disabled = false; btn.textContent = `Activar ${plans[pid].name}`; }
  }
  const myTokens = $('myTokens');
  if (myTokens) {
    myTokens.replaceChildren();
    if (!tokens.length) myTokens.append(makeElement('p', 'empty-state', 'Aún no tienes tokens. Compra uno arriba.'));
    for (const token of tokens) {
      const row = makeElement('div', 'token-row');
      row.append(makeElement('span', `tier-badge ${TIER_BADGE[token.type]}`, token.type));
      const code = makeElement('button', `token-code${token.status === 'redeemed' ? ' is-used' : ''}`, token.code);
      code.type = 'button'; code.title = token.status === 'unused' ? 'Copiar código' : 'Token ya canjeado';
      if (token.status === 'unused') code.addEventListener('click', () => copyText(token.code, 'Código copiado.'));
      row.append(code, makeElement('span', 'muted small', token.status === 'unused' ? 'Sin usar' : 'Canjeado'));
      myTokens.append(row);
    }
  }
  const myPurchases = $('myPurchases');
  if (myPurchases) {
    myPurchases.replaceChildren();
    if (!purchases.length) myPurchases.append(makeElement('p', 'empty-state', 'Todavía no hay compras.'));
    for (const p of purchases) {
      const row = makeElement('div', 'purchase-row');
      row.append(makeElement('b', '', p.item_name));
      if (p.quantity > 1) row.append(makeElement('span', 'pill', `x${p.quantity}`));
      row.append(makeElement('span', 'spacer'));
      row.append(makeElement('span', 'pill ok', `$${Number(p.price_usd).toFixed(2)}`));
      row.append(makeElement('span', 'muted small', formatDate(p.created_at)));
      myPurchases.append(row);
    }
  }
}
async function loadStore() {
  try { storeData = await api('/api/store/catalog'); renderStore(); }
  catch (error) { if (handleAuthError(error)) return; const box = $('myTokens'); if (box) box.replaceChildren(makeElement('p', 'empty-state error', `No se pudo cargar: ${error.message}`)); }
}
let checkoutItemId = null;
function openCheckout(itemId) {
  const item = findStoreItem(itemId); const overlay = $('checkoutOverlay');
  if (!item || !overlay) return;
  if (!item.available) { toast(`${item.name} todavía no está disponible.`); return; }
  checkoutItemId = itemId;
  const qtyInput = $('spaceQty');
  const qty = item.kind === 'space' ? Math.min(10, Math.max(1, Number(qtyInput?.value ?? 1) || 1)) : 1;
  if ($('checkoutItem')) $('checkoutItem').textContent = item.name;
  if ($('checkoutDetail')) $('checkoutDetail').textContent = item.description;
  if ($('checkoutQty')) $('checkoutQty').textContent = item.kind === 'space' ? `${qty} GB` : '1';
  if ($('checkoutTotal')) $('checkoutTotal').textContent = `$${(item.priceUsd * qty).toFixed(2)}`;
  const err = $('checkoutError'); if (err) err.hidden = true;
  if ($('checkoutStep1')) $('checkoutStep1').hidden = false;
  if ($('checkoutStep2')) $('checkoutStep2').hidden = true;
  const pay = $('checkoutPay');
  if (pay) { pay.disabled = false; pay.textContent = `Pagar $${(item.priceUsd * qty).toFixed(2)}`; }
  overlay.classList.add('is-open'); overlay.setAttribute('aria-hidden', 'false');
}
function closeCheckout() { const o = $('checkoutOverlay'); if (o) { o.classList.remove('is-open'); o.setAttribute('aria-hidden', 'true'); } }
async function payCheckout() {
  const pay = $('checkoutPay'); const error = $('checkoutError'); if (error) error.hidden = true;
  const item = findStoreItem(checkoutItemId); if (!item) return;
  const qtyInput = $('spaceQty');
  const qty = item.kind === 'space' ? Math.min(10, Math.max(1, Number(qtyInput?.value ?? 1) || 1)) : 1;
  if (pay) { pay.disabled = true; pay.textContent = 'Procesando…'; }
  try {
    const result = await api('/api/store/checkout', { method: 'POST', body: JSON.stringify({ itemId: checkoutItemId, quantity: qty }) });
    const receipt = result.receipt ?? {};
    if ($('successTitle')) $('successTitle').textContent = item.kind === 'token' ? 'Tu token está listo' : '¡Compra lista!';
    if ($('successMessage')) $('successMessage').textContent = receipt.message ?? item.description;
    if ($('successCreate')) $('successCreate').hidden = item.kind !== 'token';
    const box = $('successTokens');
    if (box) {
      box.replaceChildren();
      for (const t of receipt.tokens ?? []) {
        const c = makeElement('button', 'token-code', t.code); c.type = 'button'; c.title = 'Copiar';
        c.addEventListener('click', () => copyText(t.code, 'Código copiado.'));
        box.append(c);
      }
    }
    if ($('checkoutStep1')) $('checkoutStep1').hidden = true;
    if ($('checkoutStep2')) $('checkoutStep2').hidden = false;
    toast(receipt.message ?? 'Compra completada.'); await loadStore();
  } catch (err) {
    if (error) { error.textContent = err.message; error.hidden = false; }
    if (pay) { pay.disabled = false; pay.textContent = `Pagar $${(item.priceUsd * qty).toFixed(2)}`; }
  }
}
function initStore() {
  for (const b of document.querySelectorAll('.buy-button[data-item]')) {
    b.addEventListener('click', () => openCheckout(b.dataset?.item));
  }
  $('checkoutClose')?.addEventListener('click', closeCheckout);
  $('checkoutClose2')?.addEventListener('click', closeCheckout);
  $('successClose')?.addEventListener('click', closeCheckout);
  $('checkoutPay')?.addEventListener('click', () => void payCheckout());
  const overlay = $('checkoutOverlay');
  overlay?.addEventListener('click', (ev) => { if (ev.target === overlay) closeCheckout(); });
  if (typeof document !== 'undefined') document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape') closeCheckout(); });
}

/* ------------------------------ navegación ----------------------------- */
function showView(name) {
  const target = VIEW_NAMES[name] ? name : 'inicio';
  for (const link of document.querySelectorAll('[data-view]')) link.classList.toggle('is-active', link.dataset.view === target);
  for (const section of document.querySelectorAll('.view')) section.classList.toggle('is-active', section.id === `view-${target}`);
  setText('viewName', VIEW_NAMES[target]);
}
function initNav() {
  const links = document.querySelectorAll('[data-view]'); if (!links.length) return;
  for (const link of links) {
    link.addEventListener('click', (ev) => {
      ev.preventDefault(); const name = link.dataset.view;
      if (typeof location !== 'undefined') history.replaceState(null, '', `#${name}`);
      showView(name); if (typeof window.scrollTo === 'function') window.scrollTo({ top: 0, behavior: 'smooth' });
      if (name === 'monitor') void refreshSystem();
    });
  }
  if (typeof location !== 'undefined' && location.hash) showView(location.hash.slice(1));
  if (typeof window.addEventListener === 'function') {
    window.addEventListener('hashchange', () => { if (location.hash) showView(location.hash.slice(1)); });
  }
}

/* ------------------------------- landing ------------------------------- */
async function initLanding() {
  initAuthModal(); initMenuOverlay(); initReveal();
  await refreshMe(); renderAuthArea(); initLoginRedirect();
  const status = await apiOrNull('/api/status'); if (status) paintStatus(status);
  const [commands, metrics] = await Promise.all([apiOrNull('/api/commands'), apiOrNull('/api/metrics')]);
  const inv = commands?.commands ?? []; const imp = inv.filter((c) => c.implemented).length;
  const cats = new Set(inv.map((c) => c.category)).size;
  countUp('heroCount', imp); setText('heroCountLabel', 'Comandos disponibles');
  countUp('landCommands', inv.length); countUp('landImplemented', imp); countUp('landCategories', cats);
  if (metrics?.metrics) { countUp('landGroups', metrics.metrics.groups); countUp('landUsers', metrics.metrics.users); countUp('landCharacters', metrics.metrics.characters); }
  const [statusLabel] = BADGE[status?.whatsapp] ?? ['Sin datos', 'bad'];
  setText('landStatus', statusLabel);
  await refreshMenuPreview();
  $('refreshPreview')?.addEventListener('click', () => refreshMenuPreview());
  if (typeof window.setInterval === 'function') window.setInterval(refreshMenuPreview, 60_000);
}

/* ------------------------------- catálogo ------------------------------ */
function renderCatalog() {
  const box = $('catalog'); if (!box) return;
  const q = ($('commandSearch')?.value ?? '').trim().toLowerCase();
  const matches = commandInventory.filter((c) => {
    const s = `${c.name} ${c.category} ${c.description} ${c.aliases.join(' ')} ${c.usage}`.toLowerCase();
    return (commandCategory === 'Todos' || c.category === commandCategory) && s.includes(q);
  });
  box.replaceChildren();
  setText('catalogCount', `${matches.length} / ${commandInventory.length}`);
  setText('catalogMeta', `${commandInventory.length} comandos · ${commandInventory.filter((c) => c.implemented).length} implementados · ${formatDate(new Date())}`);
  if (!matches.length) { box.append(makeElement('p', 'empty-state', 'No se encontraron comandos.')); return; }
  const groups = new Map(); for (const c of matches) groups.set(c.category, [...(groups.get(c.category) ?? []), c]);
  for (const [cat, cmds] of [...groups.entries()].sort()) {
    const section = makeElement('section', 'section'); section.style.paddingTop = '0';
    const head = makeElement('div', 'section-head'); head.style.marginBottom = '18px';
    head.append(makeElement('p', 'eyebrow', cat), makeElement('h3', '', `${cmds.length} comando${cmds.length === 1 ? '' : 's'}`));
    section.append(head);
    const grid = makeElement('div', 'catalog-grid');
    for (const cmd of cmds) {
      const card = makeElement('button', 'cmd-card'); card.type = 'button'; card.title = `Copiar ${cmd.usage}`;
      const title = makeElement('div', ''); title.append(makeElement('span', 'cmd-name', `.${cmd.name}`));
      if (cmd.args) title.append(makeElement('span', 'cmd-args', cmd.args));
      card.append(title, makeElement('p', '', cmd.description));
      if (cmd.aliases.length) card.append(makeElement('span', 'cmd-alias', `alias: ${cmd.aliases.map((a) => `.${a}`).join(' ')}`));
      card.append(makeElement('span', 'cmd-alias', cmd.implemented ? '✓ disponible' : '○ pendiente'));
      card.addEventListener('click', () => copyText(cmd.usage, `${cmd.usage} copiado.`));
      grid.append(card);
    }
    section.append(grid); box.append(section);
  }
}
async function initCatalog() {
  try {
    const res = await api('/api/commands'); commandSettings = res.settings; commandInventory = res.commands;
    renderCategoryChips(); renderCatalog();
  } catch (error) { setText('catalogMeta', `No se pudo cargar: ${error.message}`); }
  $('commandSearch')?.addEventListener('input', renderCatalog);
}

/* --------------------------------- panel ------------------------------- */
async function initPanel() {
  initSidebarDrawer(); initSubBots(); initActivateModal();
  await refreshMe(); renderAuthArea();
  if (!me) goTo('/?login=1');
  const g = greetingFor(new Date().getHours()); setText('greeting', g.title);
  if (me) {
    setText('helloLine', `Hola, ${me.name}. Crea tus sub-bots, canjea tokens y administra todo desde aquí. La identidad (nombre, prefijo, banner) se edita dentro de cada sub-bot.`);
    setText('sidebarFoot', `VÉRSOVA · v1.0 · Sesión: ${me.email}`);
    const foot = $('footSession'); if (foot) foot.textContent = `Sesión: ${me.email} · plan ${me.planInfo?.name ?? me.plan}`;
  }
  initNav();
  $('pair').addEventListener('click', requestPairingCode);
  $('phone').addEventListener('keydown', (ev) => { if (ev.key === 'Enter') { ev.preventDefault(); if (!$('pair').disabled) requestPairingCode(); } });
  $('logout').addEventListener('click', requestLogout);
  $('saveDecoration').addEventListener('click', async () => {
    if (!commandSettings) return;
    const next = cloneSettings(commandSettings); next.commandDecoration = $('commandDecoration').value;
    await saveCommandConfiguration(next, 'Decoración actualizada.');
  });
  $('commandSearch').addEventListener('input', renderCommands);
  $('commandDecoration').addEventListener('keydown', (ev) => { if (ev.key === 'Enter') $('saveDecoration').click(); });
  $('pairCode').addEventListener('click', () => { if (pairingCode) copyText(pairingCode, 'Código copiado.'); });

  await Promise.all([refreshStatus(), loadCommands(), refreshMenuPreview(), refreshSystem(), refreshMetrics(), loadSubBots()]);
  startLogs();
  if (typeof window.setInterval === 'function') {
    window.setInterval(refreshStatus, 5000);
    window.setInterval(refreshSystem, 15_000);
    window.setInterval(refreshMetrics, 30_000);
  }
  showView(typeof location !== 'undefined' && location.hash ? location.hash.slice(1) : 'inicio');
}

async function initStorePage() {
  initMenuOverlay(); await refreshMe(); renderAuthArea();
  if (!me) { goTo('/?login=1&next=store'); return; }
  initStore(); await loadStore();
}
async function initCmdsPage() { initMenuOverlay(); await refreshMe(); renderAuthArea(); return initCatalog(); }

function currentPage() {
  const page = document.documentElement?.dataset?.page;
  return page === 'landing' || page === 'cmds' || page === 'store' ? page : 'home';
}
async function init() {
  initTheme();
  if (currentPage() === 'landing') return initLanding();
  if (currentPage() === 'store') return initStorePage();
  if (currentPage() === 'cmds') return initCmdsPage();
  return initPanel();
}
if (typeof window.addEventListener === 'function') {
  window.addEventListener('beforeunload', () => { stopPairingTicker(); eventSource?.close(); });
}
init().catch((error) => { console.error('No se pudo iniciar la interfaz:', error); });
