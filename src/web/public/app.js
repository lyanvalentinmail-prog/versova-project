const $ = (id) => document.getElementById(id);
const KEY = 'versova.key';
let timer = null;
let source = null;

const api = async (path, options = {}) => {
  const key = sessionStorage.getItem(KEY) ?? '';
  const res = await fetch(path, {
    ...options,
    headers: { 'Content-Type': 'application/json', 'x-console-key': key, ...(options.headers ?? {}) },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? `Error ${res.status}`);
  return data;
};

function showApp(on) {
  $('login').hidden = on;
  $('app').hidden = !on;
  if (on) {
    refreshStatus();
    refreshBanner();
    startLogs();
    timer = setInterval(refreshStatus, 4000);
  } else {
    clearInterval(timer);
    source?.close();
    $('console').textContent = '';
  }
}

async function login() {
  sessionStorage.setItem(KEY, $('key').value.trim());
  try {
    await api('/api/status');
    $('loginError').hidden = true;
    showApp(true);
  } catch (err) {
    sessionStorage.removeItem(KEY);
    $('loginError').textContent = err.message;
    $('loginError').hidden = false;
  }
}

const BADGE = { open: ['Conectado', 'open'], qr: ['Esperando QR', ''], connecting: ['Conectando…', ''], closed: ['Reconectando', 'bad'], logged_out: ['Sesión cerrada', 'bad'], idle: ['Iniciando', ''] };

async function refreshStatus() {
  try {
    const s = await api('/api/status');
    const [label, cls] = BADGE[s.whatsapp] ?? [s.whatsapp, ''];
    $('statusBadge').textContent = label;
    $('statusBadge').className = `badge ${cls}`;
    $('statusDetail').textContent = s.me ? `Número del bot ⁙ +${s.me.split('@')[0].slice(0, 2)} ••• ${s.me.split('@')[0].slice(-4)} · ${s.team}` : s.team;
    if (s.qr) { $('qr').src = s.qr; $('qr').hidden = false; $('qrEmpty').hidden = true; }
    else { $('qr').hidden = true; $('qrEmpty').hidden = false; }
  } catch (err) {
    if (err.message === 'Clave incorrecta.') showApp(false);
  }
}

async function pair() {
  $('pairError').hidden = true;
  $('pairCode').hidden = true;
  $('pair').disabled = true;
  try {
    const { code } = await api('/api/pair', { method: 'POST', body: JSON.stringify({ phone: $('phone').value }) });
    $('pairCode').textContent = code;
    $('pairCode').hidden = false;
  } catch (err) {
    $('pairError').textContent = err.message;
    $('pairError').hidden = false;
  } finally {
    $('pair').disabled = false;
  }
}

async function refreshBanner() {
  const b = await api('/api/banner');
  $('bannerText').value = b.text;
  $('bannerText').placeholder = b.defaultText;
  $('bannerImageState').textContent = b.hasImage ? `Imagen activa (${b.imageMime})` : 'Sin imagen';
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function saveBanner() {
  const file = $('bannerImage').files[0];
  const body = { text: $('bannerText').value };
  if (file) body.image = { mime: file.type, data: await fileToBase64(file) };
  try {
    await api('/api/banner', { method: 'PUT', body: JSON.stringify(body) });
    $('bannerImage').value = '';
    showBannerMsg('Banner guardado.', false);
    refreshBanner();
  } catch (err) {
    showBannerMsg(err.message, true);
  }
}

async function removeImage() {
  await api('/api/banner/image', { method: 'DELETE' });
  showBannerMsg('Imagen quitada.', false);
  refreshBanner();
}

function showBannerMsg(text, isError) {
  $('bannerMsg').textContent = text;
  $('bannerMsg').className = `small ${isError ? 'error' : 'muted'}`;
  $('bannerMsg').hidden = false;
}

function startLogs() {
  source?.close();
  source = new EventSource(`/api/logs/stream?key=${encodeURIComponent(sessionStorage.getItem(KEY) ?? '')}`);
  source.onmessage = (ev) => {
    const e = JSON.parse(ev.data);
    const line = document.createElement('div');
    line.className = `lvl-${e.level}`;
    line.textContent = `${e.time.slice(11, 19)} ${e.level.toUpperCase().padEnd(5)} [${e.scope}] ${e.message}`;
    const box = $('console');
    box.appendChild(line);
    while (box.childElementCount > 500) box.firstChild.remove();
    if ($('autoscroll').checked) box.scrollTop = box.scrollHeight;
  };
}

$('enter').onclick = login;
$('key').onkeydown = (e) => e.key === 'Enter' && login();
$('lock').onclick = () => { sessionStorage.removeItem(KEY); showApp(false); };
$('pair').onclick = pair;
$('saveBanner').onclick = saveBanner;
$('removeImage').onclick = removeImage;
$('logout').onclick = async () => {
  if (!confirm('¿Cerrar la sesión de WhatsApp? Tendrás que volver a vincular el bot.')) return;
  await api('/api/logout', { method: 'POST' }).catch((err) => alert(err.message));
};
$('bannerImage').onchange = (e) => {
  $('bannerImageState').textContent = e.target.files[0] ? `Nueva: ${e.target.files[0].name}` : '';
};

if (sessionStorage.getItem(KEY)) login();
