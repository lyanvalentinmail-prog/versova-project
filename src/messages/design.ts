import { formatDate, formatRemaining } from '../utils/time.js';
import { maskPhone, userPart } from '../utils/text.js';

/** Estética de VÉRSOVA: cada tipo de mensaje tiene su propia marca, rostro y título. */
export const LINE = 'ㅤㅤ࿚ׄ࿙ֹ࿚᮫᜔۬፟֟࿙ֹ࿚ׄ࿙';
export const SIGN = '𝑽 𝑬́ 𝑹 𝑺 𝑶 𝑽 𝑨';
export const TEAM = '◢禍◣ Versova ࿙☕࿚';

/** Cita a un usuario: el texto debe llevar @número y el JID debe ir en "mentions". */
export const mention = (jid: string): string => `@${userPart(jid)}`;

interface FrameOptions {
  mark: string;
  title: string;
  face: string;
  lines: string[];
  footer?: string;
}

export function frame(o: FrameOptions): string {
  const body = o.lines.map((l) => (l ? `ㅤ୨ৎㅤ${l}` : '')).join('\n');
  return [
    LINE,
    `ㅤㅤㅤ${o.mark}`,
    `ㅤㅤ${SIGN}`,
    `ㅤㅤㅤ${o.face}`,
    '',
    `ㅤㅤ*${o.title}*`,
    '',
    body,
    '',
    o.footer ? `ㅤ⌞ㅤ${o.footer}` : '',
    LINE,
  ].join('\n');
}

export const registroExitoso = (p: { name: string; age: number; phone: string }) =>
  frame({
    mark: '𓆩ㅤ禊ㅤ𓆪',
    title: 'REGISTRO CONFIRMADO',
    face: '( ᵕ ᴗ ᵕ )♡',
    lines: [
      `Nombre ⁙ ${p.name}`,
      `Edad ⁙ ${p.age}`,
      `Número ⁙ ${p.phone}`,
      `Fecha ⁙ ${formatDate(new Date())}`,
      '',
      'Ya formas parte del team. Pide tu personaje con .rol <personaje>.',
    ],
    footer: TEAM,
  });

export const registroRechazado = (reason: string) =>
  frame({ mark: '⸸', title: 'REGISTRO RECHAZADO', face: '(╥﹏╥)', lines: [reason] });

export const personajeAsignado = (name: string) =>
  frame({
    mark: '🥢',
    title: 'PERSONAJE ASIGNADO',
    face: '(づ๑•ᴗ•๑)づ♡',
    lines: [`Ahora interpretas a *${name}*.`, 'Tu personaje queda registrado en el team.'],
  });

export const personajeOcupado = (name: string, owner: string) =>
  frame({
    mark: '⛓️',
    title: 'PERSONAJE OCUPADO',
    face: '( •̀ - •́ )',
    lines: [`*${name}* ya pertenece a ${owner}.`, 'Elige otro personaje disponible.'],
  });

export const personajeReservado = (name: string, remaining: string) =>
  frame({
    mark: '☕',
    title: 'PERSONAJE RESERVADO',
    face: '( ˘ω˘ )',
    lines: [`*${name}* está reservado por otro integrante.`, `Tiempo restante ⁙ ${remaining}`],
  });

export const solicitudPendiente = (p: { kind: string; character: string; requester: string }) =>
  frame({
    mark: '𖤐',
    title: 'SOLICITUD PENDIENTE',
    face: '(˶ᵔ ᵕ ᵔ˶)',
    lines: [
      `${p.requester} solicita ${p.kind}: *${p.character}*`,
      'Admins: respondan a este mensaje con .acceptrol o .denyrol.',
    ],
  });

export const solicitudAprobada = (p: { character: string; user: string }) =>
  frame({
    mark: '✧',
    title: 'SOLICITUD APROBADA',
    face: '(ﾉ◕ヮ◕)ﾉ*:･ﾟ✧',
    lines: [`${p.user}, tu personaje *${p.character}* fue aprobado.`],
  });

export const solicitudRechazada = (p: { character: string; user: string }) =>
  frame({
    mark: '⸸',
    title: 'SOLICITUD RECHAZADA',
    face: '(ー_ー;)',
    lines: [`${p.user}, la solicitud de *${p.character}* fue rechazada.`, 'Tu personaje anterior se mantiene.'],
  });

export const advertencia = (p: { user: string; reason: string; count: number; limit: number }) =>
  frame({
    mark: '⚠️',
    title: 'ADVERTENCIA',
    face: '(｀へ´)',
    lines: [`${p.user}, has recibido una advertencia.`, `Motivo ⁙ ${p.reason}`, `Total ⁙ ${p.count}/${p.limit}`],
  });

export const expulsion = (p: { user: string; reason: string }) =>
  frame({
    mark: '⛓️',
    title: 'EXPULSIÓN',
    face: '(╯°□°)╯',
    lines: [`${p.user} ha sido expulsado del grupo.`, `Motivo ⁙ ${p.reason}`],
  });

export const bienvenida = (p: { user: string }) =>
  frame({
    mark: '◢禍◣',
    title: 'BIENVENIDA',
    face: '(˶˃ ᵕ ˂˶)',
    lines: [`Bienvenid@ ${p.user}.`, 'Regístrate con .reg Nombre.edad y revisa .reglas.'],
    footer: TEAM,
  });

export const despedida = (p: { user: string }) =>
  frame({
    mark: '𓆩 ☕ 𓆪',
    title: 'HASTA PRONTO',
    face: '(っ˘ω˘ς)',
    lines: [`${p.user} ya no está en el team.`, 'Su registro y personaje fueron liberados.'],
  });

export const afkOn = (p: { user: string; reason: string }) =>
  frame({
    mark: '🌙',
    title: 'AFK ACTIVADO',
    face: '( ᴗ͈ˬᴗ͈)',
    lines: [`${p.user} está ausente.`, `Motivo ⁙ ${p.reason}`, 'Se desactiva al enviar tu siguiente mensaje.'],
  });

export const afkOff = (p: { user: string }) =>
  frame({
    mark: '☀️',
    title: 'AFK DESACTIVADO',
    face: '(˶˃ ᵕ ˂˶)',
    lines: [`Bienvenid@ de vuelta, ${p.user}.`],
  });

export const afkMentioned = (p: { user: string; reason: string; since: Date }) =>
  frame({
    mark: '🌙',
    title: 'USUARIO AFK',
    face: '(ᵕ̈ ᴗ ᵕ̈)',
    lines: [`${p.user} está ausente desde ${formatDate(p.since)}.`, `Motivo ⁙ ${p.reason}`],
  });

export const propuestaPareja = (p: { from: string; to: string }) =>
  frame({
    mark: '♡',
    title: 'PROPUESTA DE PAREJA',
    face: '(づ๑•ᴗ•๑)づ♡',
    lines: [`${p.from} propone algo especial a ${p.to}.`, `${p.to}, responde con .aceptar o .rechazar.`],
  });

export const parejaConfirmada = (p: { a: string; b: string }) =>
  frame({
    mark: '♡',
    title: 'PAREJA CONFIRMADA',
    face: '(ﾉ´ヮ`)ﾉ*: ･ﾟ♡',
    lines: [`${p.a} y ${p.b} ahora son pareja.`],
  });

export const reservaCreada = (p: { character: string; remaining: string }) =>
  frame({
    mark: '☕',
    title: 'RESERVA CREADA',
    face: '( ᵕ ᴗ ᵕ )',
    lines: [`*${p.character}* queda reservado para ti.`, `Vence en ⁙ ${p.remaining}`],
  });

export const liberado = (p: { character: string }) =>
  frame({
    mark: '🥢',
    title: 'PERSONAJE LIBERADO',
    face: '( ˘ᴗ˘ )',
    lines: [`*${p.character}* vuelve a estar disponible.`],
  });

export const perfilCard = (p: { name: string; age: number; character: string; registered: Date; phone: string; afk: string; partner: string }) =>
  frame({
    mark: '𓆩 ♱ 𓆪',
    title: 'FICHA',
    face: '( ᵕ ᴗ ᵕ )',
    lines: [
      `Nombre ⁙ ${p.name}`,
      `Edad ⁙ ${p.age}`,
      `Personaje ⁙ ${p.character}`,
      `Registro ⁙ ${formatDate(p.registered)}`,
      `Número ⁙ ${p.phone}`,
      `Estado ⁙ ${p.afk}`,
      `Pareja ⁙ ${p.partner}`,
    ],
  });

export const remainingText = formatRemaining;
export const maskedPhone = maskPhone;
