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

/* ------------------------- sesión del usuario web ------------------------- */
let me = null;
let authConfig = { googleEnabled: false, demoLogin: true };

function goTo(path) {
  if (typeof location !== 'undefined') location.href = path;
}

function handleAuthError(error) {
  if (error && typeof error.message === 'string' && error.message.includes('iniciar sesión')) {
    goTo('/?login=1');
    return true;
  }
  return false;
}

async function refreshMe() {
  const data = await apiOrNull('/api/auth/me');
  me = data?.user ?? null;
  authConfig = {
    googleEnabled: Boolean(data?.googleEnabled),
    demoLogin: data?.demoLogin !== false,
  };
  return me;
}

function initialsOf(name) {
  const parts = String(name ?? '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'V';
  return parts.slice(0, 2).map((part) => part[0].toUpperCase()).join('');
}

function planClass(plan) {
  return plan === 'vip' ? 'tier-vip' : plan === 'premium' ? 'tier-premium' : '';
}

/** Pinta el área de cuenta del encabezado: botones de acceso o chip de usuario. */
function renderAuthArea() {
  const area = $('authArea');
  if (!area) return;
  area.replaceChildren();

  if (!me) {
    const login = makeElement('button', 'btn btn-sm btn-ghost', 'Iniciar sesión');
    login.type = 'button';
    login.addEventListener('click', () => openAuthModal('login'));
    const register = makeElement('button', 'btn btn-sm btn-primary', 'Crear cuenta');
    register.type = 'button';
    register.addEventListener('click', () => openAuthModal('register'));
    area.append(login, register);
    return;
  }

  const chip = makeElement('div', 'user-chip');
  const button = makeElement('button', 'chip-btn');
  button.type = 'button';
  button.setAttribute('aria-haspopup', 'true');
  button.setAttribute('aria-expanded', 'false');
  const avatar = makeElement('span', 'user-avatar', initialsOf(me.name));
  if (me.picture) {
    const image = document.createElement('img');
    image.src = me.picture;
    image.alt = '';
    avatar.replaceChildren(image);
  }
  const nameSpan = makeElement('span', '', me.name.split(' ')[0]);
  const planTag = makeElement('span', `tier-badge ${planClass(me.plan)}`, me.planInfo?.name ?? me.plan);
  button.append(avatar, nameSpan, planTag);

  const menu = makeElement('div', 'chip-menu');
  const head = makeElement('div', 'chip-head');
  head.append(makeElement('b', '', me.name));
  head.append(makeElement('span', '', me.email));
  menu.append(head);

  const panelLink = makeElement('a', '', '⌂ Ir al panel');
  panelLink.href = '/home';
  const storeLink = makeElement('a', '', '⛶ Tienda');
  storeLink.href = '/store';
  const subbotsLink = makeElement('a', '', '◈ Mis Sub-Bots');
  subbotsLink.href = '/home#subbots';
  const logoutButton = makeElement('button', 'danger', '⏻ Cerrar sesión');
  logoutButton.type = 'button';
  logoutButton.addEventListener('click', () => void doLogout());
  menu.append(panelLink, storeLink, subbotsLink, logoutButton);

  button.addEventListener('click', (event) => {
    event.stopPropagation();
    const open = menu.classList.toggle('open');
    button.setAttribute('aria-expanded', String(open));
  });
  if (typeof document !== 'undefined') {
    document.addEventListener('click', () => menu.classList.remove('open'));
  }

  chip.append(button, menu);
  area.append(chip);
}

async function doLogout() {
  try {
    await api('/api/auth/logout', { method: 'POST' });
    me = null;
    toast('Sesión cerrada.');
    window.setTimeout(() => goTo('/'), 400);
  } catch (error) {
    toast(error.message);
  }
}

/* --------------------- modal de inicio de sesión (portada) ---------------- */
function authModalElements() {
  return {
    overlay: $('authOverlay'),
    form: $('authForm'),
    title: $('authTitle'),
    submit: $('authSubmit'),
    nameField: $('authNameField'),
    error: $('authError'),
    googleButton: $('googleButton'),
    googleNote: $('googleNote'),
    tabLogin: $('authTabLogin'),
    tabRegister: $('authTabRegister'),
    close: $('authClose'),
  };
}

let authTab = 'login';

function setAuthTab(tab) {
  authTab = tab === 'register' ? 'register' : 'login';
  const elements = authModalElements();
  if (!elements.tabLogin) return;
  const isRegister = authTab === 'register';
  elements.tabLogin.classList.toggle('is-active', !isRegister);
  elements.tabRegister.classList.toggle('is-active', isRegister);
  elements.tabLogin.setAttribute('aria-selected', String(!isRegister));
  elements.tabRegister.setAttribute('aria-selected', String(isRegister));
  if (elements.nameField) elements.nameField.hidden = !isRegister;
  if (elements.title) elements.title.textContent = isRegister ? 'Crea tu cuenta' : 'Bienvenido';
  if (elements.submit) elements.submit.textContent = isRegister ? 'Crear cuenta gratis' : 'Iniciar sesión';
  if (elements.form) elements.form.autocomplete = isRegister ? 'new-password' : 'current-password';
  const password = $('authPassword');
  if (password) password.setAttribute('autocomplete', isRegister ? 'new-password' : 'current-password');
  if (elements.error) elements.error.hidden = true;
}

function openAuthModal(tab = 'login') {
  const elements = authModalElements();
  if (!elements.overlay) return;
  setAuthTab(tab);
  elements.overlay.classList.add('is-open');
  elements.overlay.setAttribute('aria-hidden', 'false');
  const email = $('authEmail');
  window.setTimeout(() => email?.focus(), 120);
}

function closeAuthModal() {
  const elements = authModalElements();
  if (!elements.overlay) return;
  elements.overlay.classList.remove('is-open');
  elements.overlay.setAttribute('aria-hidden', 'true');
}

function paintAuthConfig() {
  const elements = authModalElements();
  if (!elements.googleButton) return;
  if (authConfig.googleEnabled) {
    elements.googleButton.disabled = false;
    if (elements.googleNote) elements.googleNote.textContent = 'Abrimos Google para confirmar tu identidad y volver al panel.';
  } else {
    elements.googleButton.disabled = true;
    elements.googleButton.title = 'Configura GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET en el servidor.';
    if (elements.googleNote) {
      elements.googleNote.textContent = 'Google no está configurado en este servidor: usa email y contraseña (acceso demo).';
    }
  }
}

async function submitAuthForm(event) {
  event.preventDefault();
  const elements = authModalElements();
  if (!elements.form) return;
  const email = ($('authEmail')?.value ?? '').trim();
  const password = $('authPassword')?.value ?? '';
  const name = ($('authName')?.value ?? '').trim();
  const error = elements.error;

  const fail = (message) => {
    if (!error) return;
    error.textContent = message;
    error.hidden = false;
  };

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail('Escribe un email válido.');
  if (password.length < 6) return fail('La contraseña necesita al menos 6 caracteres.');
  if (!authConfig.demoLogin) return fail('El acceso con email está desactivado: usa Google.');

  const isRegister = authTab === 'register';
  elements.submit.disabled = true;
  elements.submit.textContent = isRegister ? 'Creando cuenta…' : 'Entrando…';
  try {
    const data = await api(isRegister ? '/api/auth/register' : '/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(isRegister ? { email, password, name } : { email, password }),
    });
    me = data.user ?? null;
    toast(isRegister ? `¡Cuenta creada! Hola, ${me?.name ?? ''}` : `Hola de nuevo, ${me?.name ?? ''}`);
    const params = new URLSearchParams(typeof location !== 'undefined' ? location.search : '');
    const next = params.get('next');
    window.setTimeout(() => goTo(next === 'store' ? '/store' : '/home'), 500);
  } catch (err) {
    fail(err.message);
    elements.submit.disabled = false;
    elements.submit.textContent = isRegister ? 'Crear cuenta gratis' : 'Iniciar sesión';
  }
}

function initAuthModal() {
  const elements = authModalElements();
  if (!elements.overlay) return;
  elements.tabLogin?.addEventListener('click', () => setAuthTab('login'));
  elements.tabRegister?.addEventListener('click', () => setAuthTab('register'));
  elements.close?.addEventListener('click', closeAuthModal);
  elements.form?.addEventListener('submit', (event) => void submitAuthForm(event));
  elements.overlay.addEventListener('click', (event) => {
    if (event.target === elements.overlay) closeAuthModal();
  });
  elements.googleButton?.addEventListener('click', () => {
    if (authConfig.googleEnabled) goTo('/api/auth/google/start');
  });
  setAuthTab('login');
  paintAuthConfig();
}

/** Abre el modal si la URL viene de un bloqueo de sesión (?login=1). */
function initLoginRedirect() {
  if (typeof location === 'undefined') return;
  const params = new URLSearchParams(location.search);
  if (params.get('login') === '1') openAuthModal(params.get('mode') === 'register' ? 'register' : 'login');
  const error = params.get('error');
  if (error) window.setTimeout(() => toast(error), 350);
}

/* ------------------------ menú de 3 líneas (tabs) ------------------------- */
function setMenuOpen(open) {
  const toggle = $('menuToggle');
  const overlay = $('menuOverlay');
  const close = $('menuClose');
  if (toggle) {
    toggle.classList.toggle('is-open', open);
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú');
  }
  if (overlay) {
    overlay.classList.toggle('is-open', open);
    overlay.setAttribute('aria-hidden', String(!open));
  }
  if (close) close.style.display = open ? '' : 'none';
  if (typeof document !== 'undefined' && document.body) document.body.style.overflow = open ? 'hidden' : '';
}

function closeMenus() {
  setMenuOpen(false);
  if (typeof document !== 'undefined' && document.body) document.body.classList.remove('nav-open');
  const toggle = $('menuToggle');
  if (toggle) toggle.setAttribute('aria-expanded', 'false');
}

/** Portada, tienda y catálogo: el menú sale en una tarjeta sobre la página. */
function initMenuOverlay() {
  const toggle = $('menuToggle');
  const overlay = $('menuOverlay');
  if (!toggle || !overlay) return;
  toggle.addEventListener('click', () => setMenuOpen(!overlay.classList.contains('is-open')));
  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) setMenuOpen(false);
  });
  $('menuClose')?.addEventListener('click', () => setMenuOpen(false));
  for (const link of overlay.querySelectorAll('a')) link.addEventListener('click', () => setMenuOpen(false));
  if (typeof document !== 'undefined') {
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') closeMenus();
    });
  }
}

/** Panel: el botón de 3 líneas abre el cajón con las pestañas del panel. */
function initSidebarDrawer() {
  const toggle = $('menuToggle');
  if (!toggle) return;
  toggle.addEventListener('click', () => {
    const open = document.body.classList.toggle('nav-open');
    toggle.classList.toggle('is-open', open);
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Cerrar pestañas' : 'Abrir pestañas');
  });
  $('navBackdrop')?.addEventListener('click', closeMenus);
  for (const link of document.querySelectorAll('.sidebar [data-view], .sidebar a[href]')) {
    link.addEventListener('click', () => closeMenus());
  }
  if (typeof document !== 'undefined') {
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') closeMenus();
    });
  }
}

/* ------------------------- animación al hacer scroll ---------------------- */
function initReveal() {
  if (typeof IntersectionObserver !== 'function' || typeof document === 'undefined') return;
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      }
    },
    { threshold: 0.12 },
  );
  for (const section of document.querySelectorAll('.section, .stats-strip, .cta-band')) {
    section.classList.add('reveal');
    observer.observe(section);
  }
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

/* ------------------------------- sub-bots -------------------------------- */
let subbotData = null;
let subbotEditingId = null;
let subbotTier = 'free';

const TIER_BADGE = { free: '', premium: 'tier-premium', vip: 'tier-vip' };

function tierInfo(tier) {
  const tiers = subbotData?.tiers ?? {};
  return tiers[tier] ?? { name: tier, spaceGb: tier === 'vip' ? 4 : tier === 'premium' ? 2 : 1 };
}

function renderSubBots() {
  const list = $('subbotList');
  if (!list || !subbotData) return;
  const bots = subbotData.bots ?? [];
  const plan = subbotData.plan ?? {};
  const usage = subbotData.usage ?? {};
  const tokens = subbotData.tokens ?? [];

  setText('navSubbotCount', `${number(usage.botsUsed ?? 0)}`);
  setText('quotaBots', `${number(usage.botsUsed ?? 0)} / ${number(usage.botsMax ?? 0)}`);
  setText('quotaPlan', `${plan.name ?? '—'} · ${plan.spacePerBotGb ?? '—'} GB por bot · máx ${plan.maxBots ?? '—'}`);
  setText('quotaExtra', `${number(usage.extraSpaceFree ?? 0)} GB`);
  setText('subbotQuota', `${usage.botsUsed ?? 0} / ${usage.botsMax ?? 0} bots`);
  countUp('statSubBots', usage.botsUsed ?? 0);
  setText('statSubBotsNote', `de ${usage.botsMax ?? '—'} permitidos por el plan ${plan.name ?? '—'}`);
  setText('statExtraSpace', `${number(usage.extraSpaceGb ?? 0)} GB`);
  setText('statExtraNote', `${number(usage.extraSpaceFree ?? 0)} GB sin asignar`);
  countUp('statTokens', usage.unusedTokens ?? tokens.filter((token) => token.status === 'unused').length);
  setText('statTokensNote', 'tokens listos para canjear');
  setText('statPlan', plan.name ?? '—');
  setText('statPlanNote', `máx ${plan.maxBots ?? '—'} bots · ${plan.spacePerBotGb ?? '—'} GB por bot`);
  const planPill = $('planPill');
  if (planPill) planPill.textContent = `Plan ${plan.name ?? '—'}`;

  list.replaceChildren();
  if (!bots.length) {
    list.append(makeElement('p', 'empty-state', 'Todavía no tienes sub-bots. Crea el primero con el botón de arriba: el tipo Free no necesita token.'));
    return;
  }

  for (const bot of bots) {
    const card = makeElement('article', 'card inset subbot-card');
    const top = makeElement('div', 'subbot-top');
    top.append(makeElement('span', 'subbot-avatar', initialsOf(bot.name)));
    const titleBox = makeElement('div');
    titleBox.append(makeElement('h4', '', bot.name));
    const status = makeElement('span', `subbot-status ${bot.status}`, bot.status === 'online' ? 'En línea' : bot.status === 'paused' ? 'Pausado' : 'Offline');
    titleBox.append(status);
    top.append(titleBox);
    top.append(makeElement('span', `tier-badge ${TIER_BADGE[bot.tier]}`, tierInfo(bot.tier).name));
    card.append(top);

    if (bot.description) card.append(makeElement('p', 'subbot-desc', bot.description));

    const meta = makeElement('div', 'subbot-meta');
    meta.append(makeElement('span', 'pill', `◈ ${tierInfo(bot.tier).name}`));
    meta.append(makeElement('span', 'pill', `⛁ ${number(bot.totalSpaceGb)} GB`));
    if (bot.extra_gb > 0) meta.append(makeElement('span', 'pill ok', `+${number(bot.extra_gb)} GB extra`));
    if (bot.phone) meta.append(makeElement('span', 'pill', `☎ ${bot.phone}`));
    if (bot.token_code) meta.append(makeElement('span', 'pill', `Token ${bot.token_code}`));
    meta.append(makeElement('span', 'pill', `Creado ${formatDate(bot.created_at)}`));
    card.append(meta);

    const actions = makeElement('div', 'row');
    const edit = makeElement('button', 'btn btn-sm btn-primary', 'Editar');
    edit.type = 'button';
    edit.addEventListener('click', () => openSubBotModal(bot));
    const toggleStatus = makeElement('button', 'btn btn-sm btn-ghost', bot.status === 'online' ? 'Pausar' : 'Activar');
    toggleStatus.type = 'button';
    toggleStatus.addEventListener('click', async () => {
      try {
        await api(`/api/subbots/${bot.id}`, { method: 'PUT', body: JSON.stringify({ status: bot.status === 'online' ? 'paused' : 'online' }) });
        toast(bot.status === 'online' ? 'Sub-bot pausado.' : 'Sub-bot activado.');
        await loadSubBots();
      } catch (error) {
        if (!handleAuthError(error)) toast(error.message);
      }
    });
    const remove = makeElement('button', 'btn btn-sm btn-danger', 'Eliminar');
    remove.type = 'button';
    remove.addEventListener('click', () => void removeSubBot(bot));
    actions.append(edit, toggleStatus, remove);
    card.append(actions);
    list.append(card);
  }
}

async function loadSubBots() {
  try {
    subbotData = await api('/api/subbots');
    renderSubBots();
  } catch (error) {
    if (handleAuthError(error)) return;
    const list = $('subbotList');
    if (list) {
      list.replaceChildren(makeElement('p', 'empty-state error', `No se pudieron cargar tus sub-bots: ${error.message}`));
    }
  }
}

async function removeSubBot(bot) {
  if (!confirm(`¿Eliminar el sub-bot «${bot.name}»? Esta acción no se puede deshacer${bot.token_code ? ' y su token queda consumido' : ''}.`)) return;
  try {
    const result = await api(`/api/subbots/${bot.id}`, { method: 'DELETE' });
    toast(result.note ?? 'Sub-bot eliminado.');
    await loadSubBots();
  } catch (error) {
    if (!handleAuthError(error)) toast(error.message);
  }
}

function openSubBotModal(bot = null) {
  const overlay = $('subbotOverlay');
  if (!overlay) return;
  subbotEditingId = bot?.id ?? null;
  subbotTier = bot?.tier ?? 'free';
  if ($('subbotModalTitle')) $('subbotModalTitle').textContent = bot ? `Editar ${bot.name}` : 'Crear sub-bot';
  if ($('subbotSubmit')) $('subbotSubmit').textContent = bot ? 'Guardar cambios' : 'Crear sub-bot';
  if ($('subbotName')) $('subbotName').value = bot?.name ?? '';
  if ($('subbotPhone')) $('subbotPhone').value = bot?.phone ?? '';
  if ($('subbotDescription')) $('subbotDescription').value = bot?.description ?? '';
  if ($('subbotToken')) $('subbotToken').value = bot?.token_code ?? '';
  if ($('subbotError')) $('subbotError').hidden = true;

  const isCreate = !bot;
  if ($('tierPicker')) {
    for (const option of $('tierPicker').querySelectorAll('.tier-option')) {
      const tier = option.dataset?.tier;
      option.classList.toggle('is-active', tier === subbotTier);
      option.disabled = !isCreate;
    }
  }
  if ($('tokenField')) $('tokenField').hidden = subbotTier === 'free';
  if ($('tokenHint')) {
    const unused = subbotData?.tokens ?? [];
    $('tokenHint').textContent = unused.length
      ? `Tienes ${unused.length} token${unused.length === 1 ? '' : 's'} sin usar. Pega el código o pulsa «Usar mío».`
      : 'No tienes tokens sin usar: cómpralos en la tienda y pega aquí el código.';
  }
  paintExtraSlider(bot);
  if ($('useLastToken')) $('useLastToken').disabled = !(subbotData?.tokens ?? []).length;
  if (isCreate && subbotTier !== 'free') subbotTier = 'free';
  if (isCreate) syncTierPicker();

  overlay.classList.add('is-open');
  overlay.setAttribute('aria-hidden', 'false');
  window.setTimeout(() => $('subbotName')?.focus(), 120);
}

function closeSubBotModal() {
  const overlay = $('subbotOverlay');
  if (!overlay) return;
  overlay.classList.remove('is-open');
  overlay.setAttribute('aria-hidden', 'true');
}

function syncTierPicker() {
  if ($('tokenField')) $('tokenField').hidden = subbotTier === 'free';
  if ($('tierPicker')) {
    for (const option of $('tierPicker').querySelectorAll('.tier-option')) {
      option.classList.toggle('is-active', option.dataset?.tier === subbotTier);
    }
  }
}

/** Slider del espacio extra (solo edición): máximo = pool libre + lo asignado a este bot. */
function paintExtraSlider(bot = null) {
  const field = $('extraField');
  if (!field) return;
  const free = Number(subbotData?.usage?.extraSpaceFree ?? 0);
  const mine = bot?.extra_gb ?? 0;
  const max = free + mine;
  field.hidden = !bot || max === 0;
  if (!bot) return;
  const slider = $('subbotExtra');
  if (!slider) return;
  slider.max = String(max);
  slider.value = String(mine);
  if ($('subbotExtraValue')) $('subbotExtraValue').textContent = `${number(mine)} GB`;
  if ($('subbotExtraHint')) {
    $('subbotExtraHint').textContent =
      max === 0 ? 'Compra espacio en la tienda para asignarlo aquí.' : `Puedes asignar hasta ${number(max)} GB (pool libre ${number(free)} GB).`;
  }
}

async function submitSubBot(event) {
  event.preventDefault();
  const button = $('subbotSubmit');
  const error = $('subbotError');
  const fail = (message) => {
    if (!error) return;
    error.textContent = message;
    error.hidden = false;
  };
  if (error) error.hidden = true;

  const body = {
    name: $('subbotName')?.value ?? '',
    phone: $('subbotPhone')?.value ?? '',
    description: $('subbotDescription')?.value ?? '',
  };
  if (button) button.disabled = true;
  try {
    if (subbotEditingId) {
      const extraSlider = $('subbotExtra');
      if (extraSlider && !$('extraField')?.hidden) body.extraGb = Number(extraSlider.value);
      await api(`/api/subbots/${subbotEditingId}`, { method: 'PUT', body: JSON.stringify(body) });
      toast('Sub-bot actualizado.');
    } else {
      body.tier = subbotTier;
      if (subbotTier !== 'free') {
        body.tokenCode = ($('subbotToken')?.value ?? '').trim();
        if (!body.tokenCode) {
          fail(`Para un sub-bot ${tierInfo(subbotTier).name} necesitas pegar el código de un token.`);
          return;
        }
      }
      await api('/api/subbots', { method: 'POST', body: JSON.stringify(body) });
      toast(`Sub-bot «${body.name}» creado.`);
    }
    closeSubBotModal();
    await loadSubBots();
  } catch (err) {
    if (!handleAuthError(err)) fail(err.message);
  } finally {
    if (button) button.disabled = false;
  }
}

function initSubBots() {
  $('createSubBot')?.addEventListener('click', () => openSubBotModal(null));
  $('subbotClose')?.addEventListener('click', closeSubBotModal);
  const overlay = $('subbotOverlay');
  overlay?.addEventListener('click', (event) => {
    if (event.target === overlay) closeSubBotModal();
  });
  $('subbotForm')?.addEventListener('submit', (event) => void submitSubBot(event));
  if ($('tierPicker')) {
    for (const option of $('tierPicker').querySelectorAll('.tier-option')) {
      option.addEventListener('click', () => {
        if (option.disabled) return;
        subbotTier = option.dataset?.tier ?? 'free';
        syncTierPicker();
      });
    }
  }
  $('subbotExtra')?.addEventListener('input', (event) => {
    if ($('subbotExtraValue')) $('subbotExtraValue').textContent = `${number(event.target.value)} GB`;
  });
  $('useLastToken')?.addEventListener('click', () => {
    const token = (subbotData?.tokens ?? []).find((entry) => entry.status === 'unused');
    if (token && $('subbotToken')) {
      $('subbotToken').value = token.code;
      toast('Token cargado desde tu cuenta.');
    }
  });
  if (typeof document !== 'undefined') {
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') closeSubBotModal();
    });
  }
}

/* --------------------------------- tienda -------------------------------- */
let storeData = null;

function findStoreItem(itemId) {
  return (storeData?.items ?? []).find((item) => item.id === itemId) ?? null;
}

function renderStore() {
  if (!storeData) return;
  const { user, usage, tokens, purchases, plans } = storeData;

  setText('storePlan', plans[user.plan].name);
  setText('storePlanNote', `máx ${plans[user.plan].maxBots} bots · ${plans[user.plan].spacePerBotGb} GB por bot`);
  setText('storeBots', `${number(usage.botsUsed)} / ${number(usage.botsMax)}`);
  setText('storeBotsNote', 'bots de tu plan');
  setText('storeExtra', `${number(usage.extraSpaceFree)} GB`);
  setText('storeExtraNote', `${number(usage.extraSpaceGb)} GB comprados en total`);
  countUp('storeTokensFree', tokens.filter((token) => token.status === 'unused').length);
  setText('storePlanPill', `Plan ${plans[user.plan].name}`);
  setText('poolTotal', `${number(usage.extraSpaceGb)} GB`);
  setText('poolUsed', `${number(usage.extraSpaceGb - usage.extraSpaceFree)} GB`);
  setText('poolFree', `${number(usage.extraSpaceFree)} GB`);

  const planOrder = { free: 0, premium: 1, vip: 2 };
  const currentRank = planOrder[user.plan] ?? 0;
  for (const card of document.querySelectorAll('.plan-card[data-plan]')) {
    const planId = card.dataset?.plan;
    const button = card.querySelector('.buy-button');
    if (!button) continue;
    if (planId === user.plan) {
      button.disabled = true;
      button.textContent = 'Tu plan actual';
    } else if ((planOrder[planId] ?? 0) <= currentRank) {
      button.disabled = true;
      button.textContent = 'Ya cubierto por tu plan';
    } else {
      button.disabled = false;
      button.textContent = `Activar ${plans[planId].name}`;
    }
  }

  const myTokens = $('myTokens');
  if (myTokens) {
    myTokens.replaceChildren();
    if (!tokens.length) {
      myTokens.append(makeElement('p', 'empty-state', 'Aún no tienes tokens. Compra uno arriba y aparecerá aquí con su código.'));
    }
    for (const token of tokens) {
      const row = makeElement('div', 'token-row');
      const badge = makeElement('span', `tier-badge ${TIER_BADGE[token.type]}`, token.type);
      row.append(badge);
      const code = makeElement('button', `token-code${token.status === 'redeemed' ? ' is-used' : ''}`, token.code);
      code.type = 'button';
      code.title = token.status === 'unused' ? 'Copiar código' : 'Token ya canjeado';
      if (token.status === 'unused') code.addEventListener('click', () => copyText(token.code, 'Código del token copiado.'));
      row.append(code);
      row.append(makeElement('span', 'muted small', token.status === 'unused' ? 'Sin usar' : 'Canjeado'));
      myTokens.append(row);
    }
  }

  const myPurchases = $('myPurchases');
  if (myPurchases) {
    myPurchases.replaceChildren();
    if (!purchases.length) {
      myPurchases.append(makeElement('p', 'empty-state', 'Todavía no hay compras registradas.'));
    }
    for (const purchase of purchases) {
      const row = makeElement('div', 'purchase-row');
      row.append(makeElement('b', '', purchase.item_name));
      if (purchase.quantity > 1) row.append(makeElement('span', 'pill', `x${purchase.quantity}`));
      row.append(makeElement('span', 'spacer'));
      row.append(makeElement('span', 'pill ok', `$${Number(purchase.price_usd).toFixed(2)}`));
      row.append(makeElement('span', 'muted small', formatDate(purchase.created_at)));
      myPurchases.append(row);
    }
  }
}

async function loadStore() {
  try {
    storeData = await api('/api/store/catalog');
    renderStore();
  } catch (error) {
    if (handleAuthError(error)) return;
    const box = $('myTokens');
    if (box) box.replaceChildren(makeElement('p', 'empty-state error', `No se pudo cargar la tienda: ${error.message}`));
  }
}

let checkoutItemId = null;

function openCheckout(itemId) {
  const item = findStoreItem(itemId);
  const overlay = $('checkoutOverlay');
  if (!item || !overlay) return;
  if (!item.available) {
    toast(`${item.name} todavía no está disponible.`);
    return;
  }
  checkoutItemId = itemId;

  const qtyInput = $('spaceQty');
  const quantity = item.kind === 'space' ? Math.min(10, Math.max(1, Number(qtyInput?.value ?? 1) || 1)) : 1;
  if ($('checkoutItem')) $('checkoutItem').textContent = item.name;
  if ($('checkoutDetail')) $('checkoutDetail').textContent = item.description;
  if ($('checkoutQty')) $('checkoutQty').textContent = item.kind === 'space' ? `${quantity} GB` : '1';
  if ($('checkoutTotal')) $('checkoutTotal').textContent = `$${(item.priceUsd * quantity).toFixed(2)}`;
  const error = $('checkoutError');
  if (error) error.hidden = true;

  const step1 = $('checkoutStep1');
  const step2 = $('checkoutStep2');
  if (step1) step1.hidden = false;
  if (step2) step2.hidden = true;

  const pay = $('checkoutPay');
  if (pay) {
    pay.disabled = false;
    pay.textContent = `Pagar $${(item.priceUsd * quantity).toFixed(2)}`;
  }

  overlay.classList.add('is-open');
  overlay.setAttribute('aria-hidden', 'false');
}

function closeCheckout() {
  const overlay = $('checkoutOverlay');
  if (!overlay) return;
  overlay.classList.remove('is-open');
  overlay.setAttribute('aria-hidden', 'true');
}

async function payCheckout() {
  const pay = $('checkoutPay');
  const error = $('checkoutError');
  if (error) error.hidden = true;
  const item = findStoreItem(checkoutItemId);
  if (!item) return;
  const qtyInput = $('spaceQty');
  const quantity = item.kind === 'space' ? Math.min(10, Math.max(1, Number(qtyInput?.value ?? 1) || 1)) : 1;

  if (pay) {
    pay.disabled = true;
    pay.textContent = 'Procesando…';
  }
  try {
    const result = await api('/api/store/checkout', {
      method: 'POST',
      body: JSON.stringify({ itemId: checkoutItemId, quantity }),
    });
    const receipt = result.receipt ?? {};
    if ($('successTitle')) $('successTitle').textContent = item.kind === 'token' ? 'Tu token está listo' : '¡Compra lista!';
    if ($('successMessage')) $('successMessage').textContent = receipt.message ?? item.description;
    if ($('successCreate')) $('successCreate').hidden = item.kind !== 'token';

    const box = $('successTokens');
    if (box) {
      box.replaceChildren();
      for (const token of receipt.tokens ?? []) {
        const code = makeElement('button', 'token-code', token.code);
        code.type = 'button';
        code.title = 'Copiar código';
        code.addEventListener('click', () => copyText(token.code, 'Código del token copiado.'));
        box.append(code);
      }
    }
    const step1 = $('checkoutStep1');
    const step2 = $('checkoutStep2');
    if (step1) step1.hidden = true;
    if (step2) step2.hidden = false;
    toast(receipt.message ?? 'Compra completada.');
    await loadStore();
  } catch (err) {
    if (error) {
      error.textContent = err.message;
      error.hidden = false;
    }
    if (pay) {
      pay.disabled = false;
      pay.textContent = `Pagar $${(item.priceUsd * quantity).toFixed(2)}`;
    }
  }
}

function initStore() {
  for (const button of document.querySelectorAll('.buy-button[data-item]')) {
    button.addEventListener('click', () => openCheckout(button.dataset?.item));
  }
  $('checkoutClose')?.addEventListener('click', closeCheckout);
  $('checkoutClose2')?.addEventListener('click', closeCheckout);
  $('successClose')?.addEventListener('click', closeCheckout);
  $('checkoutPay')?.addEventListener('click', () => void payCheckout());
  const overlay = $('checkoutOverlay');
  overlay?.addEventListener('click', (event) => {
    if (event.target === overlay) closeCheckout();
  });
  if (typeof document !== 'undefined') {
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') closeCheckout();
    });
  }
}

/* ------------------------------ navegación ----------------------------- */
const VIEW_NAMES = {
  inicio: 'Inicio',
  subbots: 'Mis Sub-Bots',
  conexion: 'Conexión',
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
  initAuthModal();
  initMenuOverlay();
  initReveal();
  await refreshMe();
  renderAuthArea();
  initLoginRedirect();

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
  initSidebarDrawer();
  initSubBots();
  await refreshMe();
  renderAuthArea();
  if (!me) goTo('/?login=1'); // el servidor ya redirige; esto es una red de seguridad.

  const greeting = greetingFor(new Date().getHours());
  setText('greeting', greeting.title);
  if (me) {
    setText('helloLine', `Hola, ${me.name}. Creas tus sub-bots, canjeas tokens y administras todo desde aquí.`);
    setText('sidebarFoot', `VÉRSOVA · v1.0 · Sesión: ${me.email}`);
    const foot = $('footSession');
    if (foot) foot.textContent = `Sesión: ${me.email} · plan ${me.planInfo?.name ?? me.plan}`;
  }

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

  await Promise.all([refreshStatus(), refreshBanner(), loadCommands(), refreshMenuPreview(), refreshSystem(), refreshMetrics(), loadSubBots()]);
  startLogs();
  if (typeof window.setInterval === 'function') {
    window.setInterval(refreshStatus, 5000);
    window.setInterval(refreshSystem, 15_000);
    window.setInterval(refreshMetrics, 30_000);
  }
  showView(typeof location !== 'undefined' && location.hash ? location.hash.slice(1) : 'inicio');
}

/* --------------------------------- tienda (página) ---------------------- */
async function initStorePage() {
  initMenuOverlay();
  await refreshMe();
  renderAuthArea();
  if (!me) {
    goTo('/?login=1&next=store');
    return;
  }
  initStore();
  await loadStore();
}

/* --------------------------------- catálogo ----------------------------- */
async function initCmdsPage() {
  initMenuOverlay();
  await refreshMe();
  renderAuthArea();
  return initCatalog();
}

/* --------------------------------- arranque ---------------------------- */
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
  window.addEventListener('beforeunload', () => {
    stopPairingTicker();
    eventSource?.close();
  });
}

init().catch((error) => {
  console.error('No se pudo iniciar la interfaz:', error);
});
