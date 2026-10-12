import { config } from '../config/index.js';
import { formatDate, formatRemaining } from '../utils/time.js';
import { TEAM, frame, mention } from './design.js';

/* =========================================================================
   Plantillas de los comandos de gestión, administración y social.
   Mantienen la misma estética que el resto del menú de VÉRSOVA.
   ========================================================================= */

export const teamInfo = (p: {
  name: string;
  members: number;
  admins: number;
  registered: number;
  characters: number;
  occupied: number;
  prefix: string;
}) =>
  frame({
    mark: '◢禍◣',
    title: 'INFORMACIÓN DEL TEAM',
    face: '( ᵕ ᴗ ᵕ )',
    lines: [
      `Nombre ⁙ ${p.name}`,
      `Integrantes ⁙ ${p.members}`,
      `Administradores ⁙ ${p.admins}`,
      `Registrados ⁙ ${p.registered}`,
      `Personajes ⁙ ${p.occupied}/${p.characters} ocupados`,
      `Prefijo ⁙ ${p.prefix}`,
      `Estado ⁙ online`,
      `Versión ⁙ ${config.bot.version}`,
    ],
    footer: TEAM,
  });

export const miembrosList = (p: { names: string[]; total: number }) =>
  frame({
    mark: '👥',
    title: 'INTEGRANTES',
    face: '(˶˃ ᵕ ˂˶)',
    lines: [
      `Total ⁙ ${p.total}`,
      '',
      ...p.names.map((name, index) => `${String(index + 1).padStart(2, '0')} ⁙ ${name}`),
    ],
    footer: `Para ver la ficha de alguien: ${config.bot.prefix}perfil @usuario`,
  });

export const inactivosList = (p: { days: number; rows: Array<{ name: string; since: Date }> }) =>
  frame({
    mark: '💤',
    title: 'INTEGRANTES INACTIVOS',
    face: '(っ˘ω˘ς)',
    lines: p.rows.length
      ? [
          `Sin actividad desde hace más de ${p.days} días ⁙ ${p.rows.length}`,
          '',
          ...p.rows.map((row) => `${row.name} ⁙ ${formatDate(row.since)}`),
        ]
      : [`Nadie lleva más de ${p.days} días sin hablar. ¡Team activo! ⚡`],
  });

export const perfilUsuario = (p: {
  user: string;
  name: string;
  age: number;
  character: string;
  registered: Date;
  afk: string;
  partner: string;
  warnings: number;
}) =>
  frame({
    mark: '𓆩 ♱ 𓆪',
    title: 'PERFIL',
    face: '( ᵕ ᴗ ᵕ )',
    lines: [
      `Usuario ⁙ ${p.user}`,
      `Nombre ⁙ ${p.name}`,
      `Edad ⁙ ${p.age}`,
      `Personaje ⁙ ${p.character}`,
      `Registro ⁙ ${formatDate(p.registered)}`,
      `Pareja ⁙ ${p.partner}`,
      `Estado ⁙ ${p.afk}`,
      `Advertencias ⁙ ${p.warnings}/${config.defaults.warnLimit}`,
    ],
  });

export const noRegistrado = (command: string) =>
  frame({
    mark: '⸸',
    title: 'SIN REGISTRO',
    face: '(・_・;)',
    lines: [`Necesitas registrarte antes de usar ${command}.`, `Usa ⁙ ${config.bot.prefix}reg Nombre.edad`],
  });

export const soloAdmins = (command: string) =>
  frame({
    mark: '⛔',
    title: 'SOLO ADMINISTRADORES',
    face: '( •̀ - •́ )✧',
    lines: [`${command} es exclusivo del staff del grupo.`],
  });

export const faltaObjetivo = (uso: string) =>
  frame({ mark: '✎', title: 'FALTA INFORMACIÓN', face: '(¬_¬)', lines: [`Uso correcto ⁙ ${uso}`] });

export const parejaRechazada = (p: { from: string; to: string }) =>
  frame({
    mark: '💔',
    title: 'PROPUESTA RECHAZADA',
    face: '(╥﹏╥)',
    lines: [`${p.to} rechazó la propuesta de ${p.from}.`, 'Sigue intentando con otra persona.'],
  });

export const parejaOcupada = (p: { user: string; partner: string }) =>
  frame({
    mark: '♡',
    title: 'YA TIENE PAREJA',
    face: '( ˘ ³˘)',
    lines: [`${p.user} ya está en pareja con ${p.partner}.`, `Puede terminar la relación con ${config.bot.prefix}rechazar.`],
  });

export const parejaTerminada = (p: { a: string; b: string }) =>
  frame({
    mark: '💔',
    title: 'RELACIÓN TERMINADA',
    face: '(っ- ‸ - ς)',
    lines: [`${p.a} y ${p.b} ya no son pareja.`],
  });

export const shipResult = (p: { a: string; b: string; percent: number; message: string }) =>
  frame({
    mark: '♡',
    title: 'SHIP',
    face: '(づ๑•ᴗ•๑)づ♡',
    lines: [`${p.a} + ${p.b}`, `Compatibilidad ⁙ ${p.percent}%`, '', p.message],
  });

export const reglasTexto = (p: { rules: string }) =>
  frame({
    mark: '📜',
    title: 'REGLAS DEL TEAM',
    face: '( ᵕ ᴗ ᵕ )',
    lines: p.rules ? p.rules.split('\n') : ['El staff todavía no publicó las reglas.', `Un admin puede fijarlas con ${config.bot.prefix}reglas set <texto>`],
    footer: TEAM,
  });

export const reglasGuardadas = () =>
  frame({ mark: '📜', title: 'REGLAS ACTUALIZADAS', face: '(๑˃̵ᴗ˂̵)و', lines: ['Las reglas del grupo quedaron guardadas.'] });

export const adminsList = (p: { admins: string[] }) =>
  frame({
    mark: '🛡️',
    title: 'ADMINISTRADORES',
    face: '( •̀ - •́ )✧',
    lines: p.admins.length ? p.admins.map((admin, index) => `${String(index + 1).padStart(2, '0')} ⁙ ${admin}`) : ['No hay administradores registrados todavía.'],
  });

export const accionAdd = (p: { user: string; by: string }) =>
  frame({ mark: '➕', title: 'INTEGRANTE AÑADIDO', face: '(๑˃̵ᴗ˂̵)و', lines: [`${p.user} fue añadido al grupo por ${p.by}.`] });

export const accionBan = (p: { user: string; reason: string; by: string }) =>
  frame({
    mark: '⛓️',
    title: 'INTEGRANTE BLOQUEADO',
    face: '(╯°□°)╯',
    lines: [`${p.user} fue bloqueado por ${p.by}.`, `Motivo ⁙ ${p.reason}`, `Puede volver con ${config.bot.prefix}unban @usuario`],
  });

export const accionUnban = (p: { user: string }) =>
  frame({ mark: '🔓', title: 'BLOQUEO RETIRADO', face: '( ᵕ ᴗ ᵕ )', lines: [`${p.user} ya puede volver al team.`] });

export const sinBloqueo = (p: { user: string }) =>
  frame({ mark: 'ℹ️', title: 'SIN BLOQUEO', face: '(・_・;)', lines: [`${p.user} no está bloqueado.`] });

export const advertirQuitada = (p: { user: string; remaining: number }) =>
  frame({
    mark: '🧾',
    title: 'ADVERTENCIA RETIRADA',
    face: '( ᵕ ᴗ ᵕ )',
    lines: [`Se retiró la advertencia más reciente de ${p.user}.`, `Le quedan ⁙ ${p.remaining}`],
  });

export const anuncio = (p: { author: string; text: string }) =>
  frame({
    mark: '📣',
    title: 'ANUNCIO DEL STAFF',
    face: '(๑˃̵ᴗ˂̵)و',
    lines: [p.text, '', `— ${p.author}`],
    footer: TEAM,
  });

export const grupoEstado = (p: { open: boolean }) =>
  frame({
    mark: p.open ? '🔓' : '🔒',
    title: p.open ? 'GRUPO ABIERTO' : 'GRUPO CERRADO',
    face: p.open ? '(˶˃ ᵕ ˂˶)' : '( •̀ - •́ )',
    lines: [
      p.open ? 'Todos los integrantes pueden escribir de nuevo.' : 'Solo los administradores pueden escribir.',
    ],
  });

export const noPuedoHacerlo = (detalle: string) =>
  frame({ mark: '⚠️', title: 'NO SE PUDO COMPLETAR', face: '(｡•́︿•̀｡)', lines: [detalle] });

export const recordatorio = (p: { text: string; when: string }) =>
  frame({ mark: '⏰', title: 'RECORDATORIO', face: '(˶˃ ᵕ ˂˶)', lines: [p.text, `Programado ⁙ ${p.when}`] });

export const tiempoRestante = formatRemaining;
export const mencion = mention;
