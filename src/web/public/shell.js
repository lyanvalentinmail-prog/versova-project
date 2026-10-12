/* =========================================================================
   VÉRSOVA · shell.js — armazón común de la plataforma
   Barra superior, navegación inferior, menú de pestañas, avisos, tema y
   sesión. Se carga en todas las páginas antes de app.js.
   ========================================================================= */

const V = (() => {
  const state = {
    user: null,
    platform: null,
    auth: { googleEnabled: false, demoLogin: true },
    economy: null,
  };

  /* ------------------------------- utilidades ------------------------------ */

  const $ = (id) => document.getElementById(id);
  const qs = (sel, root = document) => root.querySelector(sel);
  const qsa = (sel, root = document) => [...root.querySelectorAll(sel)];

  const el = (tag, attrs = {}, children = []) => {
    const node = document.createElement(tag);
    for (const [key, value] of Object.entries(attrs)) {
      if (key === 'class') node.className = value;
      else if (key === 'text') node.textContent = value;
      else if (key === 'html') node.innerHTML = value;
      else if (key.startsWith('on') && typeof value === 'function') node.addEventListener(key.slice(2), value);
      else if (value !== null && value !== undefined && value !== false) node.setAttribute(key, value);
    }
    for (const child of [].concat(children)) {
      if (child === null || child === undefined || child === false) continue;
      node.append(child instanceof Node ? child : document.createTextNode(String(child)));
    }
    return node;
  };

  const escape = (value) =>
    String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));

  const num = (value) => new Intl.NumberFormat('es-UY').format(Number(value ?? 0));

  const coins = (value) => `🪙 ${num(value)}`;

  function uptime(seconds) {
    const total = Math.max(0, Math.floor(Number(seconds) || 0));
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    return `${h}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`;
  }

  function timeAgo(value) {
    if (!value) return '—';
    const diff = Date.now() - new Date(value).getTime();
    if (Number.isNaN(diff)) return '—';
    const mins = Math.round(diff / 60000);
    if (mins < 1) return 'hace instantes';
    if (mins < 60) return `hace ${mins} min`;
    const hours = Math.round(mins / 60);
    if (hours < 24) return `hace ${hours} h`;
    return `hace ${Math.round(hours / 24)} d`;
  }

  const dateTime = (value) =>
    value
      ? new Date(value).toLocaleString('es-UY', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' })
      : '—';

  /* --------------------------------- API ---------------------------------- */

  async function api(path, options = {}) {
    const response = await fetch(path, {
      credentials: 'same-origin',
      headers: options.body ? { 'Content-Type': 'application/json' } : undefined,
      method: options.method ?? (options.body ? 'POST' : 'GET'),
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
    let data = {};
    try {
      data = await response.json();
    } catch {
      data = {};
    }
    if (!response.ok) {
      const error = new Error(data.error || `Error ${response.status}`);
      error.status = response.status;
      error.data = data;
      throw error;
    }
    return data;
  }

  /* --------------------------------- avisos -------------------------------- */

  function toast(title, text = '', kind = '') {
    let wrap = $('toastWrap');
    if (!wrap) {
      wrap = el('div', { class: 'toast-wrap', id: 'toastWrap' });
      document.body.append(wrap);
    }
    const node = el('div', { class: `toast ${kind}` }, [
      el('div', { class: 'ico', text: kind === 'err' ? '⚠️' : kind === 'ok' ? '✅' : 'ℹ️' }),
      el('div', { class: 'grow' }, [el('b', { text: title }), text ? el('p', { text }) : null]),
      el('button', { class: 'close', text: '✕', type: 'button', onclick: () => node.remove() }),
      el('i', { class: 'bar' }),
    ]);
    wrap.append(node);
    setTimeout(() => node.remove(), 6000);
  }

  /* ---------------------------------- tema --------------------------------- */

  function applyTheme(theme) {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem('versova-theme', theme);
    } catch {
      /* almacenamiento no disponible */
    }
    const button = $('themeToggle');
    if (button) button.textContent = theme === 'dark' ? '🌙' : '☀️';
  }

  function toggleTheme() {
    applyTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
  }

  /* ------------------------------ navegación ------------------------------- */

  const NAV = [
    { href: '/', label: 'Inicio', ico: '⌂' },
    { href: '/registrar', label: 'Registrar', ico: '＋' },
    { href: '/bots', label: 'Mis Bots', ico: '🤖' },
    { href: '/metrics', label: 'Métricas', ico: '📊' },
    { href: '/store', label: 'Tienda', ico: '👑' },
    { href: '#menu', label: 'Menú', ico: '☰' },
  ];

  const MENU = [
    { href: '/', ico: '⌂', title: 'Inicio', text: 'Resumen de tu plataforma y economía' },
    { href: '/registrar', ico: '＋', title: 'Registrar bot', text: 'Asistente de 5 pasos' },
    { href: '/bots', ico: '🤖', title: 'Mis Bots', text: 'Sesiones activas y opciones' },
    { href: '/store', ico: '🛒', title: 'Tienda', text: 'Tokens, espacio, monedas y bots' },
    { href: '/cmds', ico: '⌘', title: 'Comandos', text: 'Catálogo completo de comandos' },
    { href: '/metrics', ico: '📈', title: 'Métricas', text: 'Telemetría y servidores en vivo' },
    { href: '/ticket', ico: '🎫', title: 'Reportes', text: 'Reporta un bug o sugiere una idea' },
    { href: '/links', ico: '🔗', title: 'Links oficiales', text: 'Canales, grupos y recursos' },
  ];

  function userAvatar(size = 32) {
    const user = state.user;
    if (user?.avatarUrl || user?.picture) {
      return el('img', { src: user.avatarUrl || user.picture, alt: user.name, class: 'avatar', style: `width:${size}px;height:${size}px` });
    }
    const initials = (user?.name || 'V').trim().charAt(0).toUpperCase();
    return el('span', { class: 'avatar', text: initials, style: `width:${size}px;height:${size}px` });
  }

  function openSheet(id) {
    const sheet = $(id);
    if (!sheet) return;
    sheet.classList.add('is-open');
    sheet.setAttribute('aria-hidden', 'false');
  }

  function closeSheet(id) {
    const sheet = $(id);
    if (!sheet) return;
    sheet.classList.remove('is-open');
    sheet.setAttribute('aria-hidden', 'true');
  }

  function buildChrome() {
    const page = document.documentElement.dataset.page || 'home';
    const topbar = el('header', { class: 'topbar' }, [
      el('a', { class: 'brand', href: '/' }, [
        el('span', { class: 'brand-mark', text: '✦', 'aria-hidden': 'true' }),
        el('span', {}, [
          el('span', { class: 'brand-name', text: 'VÉRSOVA' }),
          el('span', { class: 'brand-sub', text: 'bot platform' }),
        ]),
      ]),
      el('div', { class: 'top-actions' }, [
        el('span', { class: 'pill hide-sm', id: 'navStatus' }, [el('i', { class: 'dot' }), el('span', { text: '…' })]),
        el('button', { class: 'icon-btn', id: 'themeToggle', type: 'button', 'aria-label': 'Cambiar tema', onclick: toggleTheme, text: '🌙' }),
        el('div', { style: 'position:relative' }, [
          el('button', { class: 'avatar-btn', id: 'avatarBtn', type: 'button', 'aria-label': 'Tu cuenta' }, [
            userAvatar(),
            el('span', { class: 'tiny muted hide-sm', id: 'avatarName', text: state.user ? state.user.name : 'Invitado' }),
            el('span', { class: 'tiny muted', text: '⌄' }),
          ]),
        ]),
      ]),
    ]);
    document.body.prepend(topbar);

    const nav = el('nav', { class: 'bottom-nav', 'aria-label': 'Navegación principal' },
      NAV.map((item) => {
        const isMenu = item.href === '#menu';
        const active = !isMenu && (item.href === '/' ? page === 'home' : item.href === `/${page}`);
        return el('a', {
          href: isMenu ? '#' : item.href,
          class: active ? 'is-active' : '',
          onclick: isMenu ? (event) => { event.preventDefault(); openSheet('menuSheet'); } : undefined,
        }, [el('span', { class: 'nav-ico', text: item.ico }), el('span', { text: item.label })]);
      }),
    );
    document.body.append(nav);

    const sheet = el('div', { class: 'sheet', id: 'menuSheet', 'aria-hidden': 'true' }, [
      el('div', { class: 'sheet-backdrop', onclick: () => closeSheet('menuSheet') }),
      el('div', { class: 'sheet-panel' }, [
        el('div', { class: 'row-between' }, [
          el('div', {}, [el('span', { class: 'label', text: 'Navegación' }), el('h3', { text: 'Todas las secciones' })]),
          el('button', { class: 'icon-btn', type: 'button', text: '✕', onclick: () => closeSheet('menuSheet') }),
        ]),
        el('div', { style: 'height:14px' }),
        el('div', { class: 'menu-grid' }, MENU.map((item) =>
          el('a', { class: 'menu-item', href: item.href }, [
            el('span', { class: 'ico', text: item.ico }),
            el('span', { class: 'grow' }, [el('b', { text: item.title }), el('span', { text: item.text })]),
            el('span', { class: 'muted', text: '›' }),
          ]),
        )),
        el('div', { style: 'height:14px' }),
        state.user
          ? el('button', { class: 'btn btn-block btn-ghost', type: 'button', text: 'Cerrar sesión', onclick: logout })
          : el('a', { class: 'btn btn-primary btn-block', href: '/?login=1', text: 'Iniciar sesión' }),
      ]),
    ]);
    document.body.append(sheet);

    const avatarBtn = $('avatarBtn');
    avatarBtn?.addEventListener('click', (event) => {
      event.stopPropagation();
      const existing = $('avatarMenu');
      if (existing) return existing.remove();
      const menu = el('div', { class: 'dropdown', id: 'avatarMenu' }, state.user
        ? [
            el('div', { class: 'drop-head' }, [
              el('b', { text: state.user.name }),
              el('div', { class: 'small muted wrap-text', text: state.user.email }),
              el('div', { class: 'small', style: 'margin-top:6px' }, [
                el('span', { class: 'pill accent', text: `Plan ${state.user.planInfo?.name ?? state.user.plan}` }),
                el('span', { class: 'pill', text: `🪙 ${num(state.user.coins)}` }),
              ]),
            ]),
            el('a', { href: '/bots' }, ['🤖 Mis Bots']),
            el('a', { href: '/registrar' }, ['＋ Registrar bot']),
            el('a', { href: '/store' }, ['🛒 Tienda']),
            el('a', { href: '/ticket' }, ['🎫 Reportes']),
            el('button', { type: 'button', onclick: logout }, ['🚪 Cerrar sesión']),
          ]
        : [
            el('div', { class: 'drop-head' }, [el('b', { text: 'Invitado' }), el('div', { class: 'small muted', text: 'Inicia sesión para usar la plataforma' })]),
            el('a', { href: '/?login=1' }, ['🔐 Iniciar sesión']),
            el('a', { href: '/cmds' }, ['⌘ Comandos']),
          ]);
      document.body.append(menu);
      setTimeout(() => document.addEventListener('click', () => menu.remove(), { once: true }), 0);
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        closeSheet('menuSheet');
        closeSheet('modalBot');
        $('avatarMenu')?.remove();
      }
    });

    if (!document.documentElement.dataset.noLoading) {
      const loading = el('div', { class: 'loading-screen', id: 'loadingScreen' }, [
        el('div', { class: 'spinner' }),
        el('span', { class: 'mono tiny muted', text: 'CARGANDO…' }),
      ]);
      document.body.append(loading);
    }
  }

  function hideLoading() {
    const loading = $('loadingScreen');
    if (!loading) return;
    loading.classList.add('is-hidden');
    setTimeout(() => loading.remove(), 400);
  }

  /* --------------------------------- sesión -------------------------------- */

  async function loadSession() {
    try {
      const data = await api('/api/auth/me');
      state.user = data.user ?? null;
      state.auth = { googleEnabled: Boolean(data.googleEnabled), demoLogin: data.demoLogin !== false };
      state.economy = state.user ? { coins: state.user.coins } : null;
    } catch {
      state.user = null;
    }
    return state.user;
  }

  async function logout() {
    try {
      await api('/api/auth/logout', { body: {} });
    } catch {
      /* sin sesión activa */
    }
    window.location.href = '/';
  }

  async function loadPlatform() {
    if (state.platform) return state.platform;
    try {
      state.platform = await api('/api/platform');
    } catch {
      state.platform = null;
    }
    return state.platform;
  }

  function setStatus(online, text) {
    const pill = $('navStatus');
    if (!pill) return;
    pill.querySelector('.dot')?.setAttribute('class', `dot ${online ? 'live' : 'off'}`);
    const label = pill.querySelector('span:last-child');
    if (label) label.textContent = text;
  }

  function setText(id, value) {
    const node = $(id);
    if (node) node.textContent = value;
  }

  function fill(id, value) {
    const node = $(id);
    if (node) node.innerHTML = value;
  }

  /* ------------------------------ autorización ----------------------------- */

  async function ensureSession() {
    const user = await loadSession();
    if (!user) {
      window.location.href = '/?login=1';
      return null;
    }
    return user;
  }

  function googleButton() {
    if (!state.auth.googleEnabled) return null;
    return el('div', {}, [
      el('div', { class: 'divider', text: 'o' }),
      el('div', { style: 'height:10px' }),
      el('a', { class: 'btn btn-block', href: '/api/auth/google/start' }, ['🅖 Continuar con Google']),
    ]);
  }

  /* -------------------------- componentes reutilizables -------------------- */

  function statTile(label, value, hint, id) {
    return el('div', { class: 'stat-tile' }, [
      el('span', { class: 'label', text: label }),
      el('b', { id, text: value }),
      el('span', { text: hint }),
    ]);
  }

  function meter(percent, warn = false) {
    return el('div', { class: `meter${warn ? ' warn' : ''}` }, [el('i', { style: `width:${Math.min(100, Math.max(0, percent))}%` })]);
  }

  function note(text, kind = '') {
    return el('div', { class: `note ${kind}`, text });
  }

  function confirmDialog(title, text) {
    return window.confirm(`${title}\n\n${text}`);
  }

  function modal(id) {
    return $(id);
  }

  function openModal(id) {
    openSheet(id);
    document.body.style.overflow = 'hidden';
  }

  function closeModal(id) {
    closeSheet(id);
    document.body.style.overflow = '';
  }

  function copy(text) {
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).then(() => toast('Copiado', text, 'ok')).catch(() => toast('No se pudo copiar', text, 'err'));
      return;
    }
    const area = document.createElement('textarea');
    area.value = text;
    document.body.append(area);
    area.select();
    document.execCommand?.('copy');
    area.remove();
    toast('Copiado', text, 'ok');
  }

  return {
    state, $, qs, qsa, el, escape, num, coins, uptime, timeAgo, dateTime, api, toast, applyTheme, toggleTheme,
    buildChrome, hideLoading, loadSession, loadPlatform, logout, ensureSession, setStatus, setText, fill,
    googleButton, statTile, meter, note, confirmDialog, openModal, closeModal, openSheet, closeSheet, copy,
    NAV, MENU,
  };
})();

window.V = V;
