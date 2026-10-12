/**
 * Catálogo de reacciones anime de Raiden WaBot (más de 40).
 * Cada entrada genera un comando propio (`.hug`, `.kiss`…) además de `.reaccion <tipo>`.
 */

export interface ReactionDef {
  /** Nombre del comando (sin prefijo). */
  name: string;
  emoji: string;
  /** Texto de la acción: se interpola `{a}` y `{b}`. */
  text: string;
  /** Alternativa en español usada como alias. */
  alias?: string;
}

export const REACTIONS: ReactionDef[] = [
  { name: 'hug', emoji: '🤗', text: '{a} le dio un abrazo enorme a {b}', alias: 'abrazo' },
  { name: 'kiss', emoji: '💋', text: '{a} le dio un beso a {b}', alias: 'besar' },
  { name: 'pat', emoji: '🫳', text: '{a} le acarició la cabeza a {b}', alias: 'acariciar' },
  { name: 'slap', emoji: '✋', text: '{a} le dio una bofetada a {b}', alias: 'bofetada' },
  { name: 'cuddle', emoji: '🫂', text: '{a} se acurrucó con {b}', alias: 'apapacho' },
  { name: 'bite', emoji: '😬', text: '{a} le dio un mordisco a {b}', alias: 'morder' },
  { name: 'lick', emoji: '👅', text: '{a} lamió a {b} 👀', alias: 'lamer' },
  { name: 'poke', emoji: '👉', text: '{a} le dio un toque a {b}', alias: 'toque' },
  { name: 'tickle', emoji: '🪶', text: '{a} le hizo cosquillas a {b}', alias: 'cosquillas' },
  { name: 'highfive', emoji: '🙌', text: '{a} chocó los cinco con {b}', alias: 'choca' },
  { name: 'handshake', emoji: '🤝', text: '{a} le dio la mano a {b}', alias: 'saludo' },
  { name: 'dance', emoji: '💃', text: '{a} bailó con {b}', alias: 'bailar' },
  { name: 'sing', emoji: '🎤', text: '{a} le cantó una canción a {b}', alias: 'cantar' },
  { name: 'smile', emoji: '😊', text: '{a} le sonrió a {b}', alias: 'sonrisa' },
  { name: 'wink', emoji: '😉', text: '{a} le guiñó el ojo a {b}', alias: 'guino' },
  { name: 'blush', emoji: '😳', text: '{a} se sonrojó por {b}', alias: 'sonrojo' },
  { name: 'cry', emoji: '😭', text: '{a} llora en el hombro de {b}', alias: 'llorar' },
  { name: 'pout', emoji: '😤', text: '{a} le hizo un mohín a {b}', alias: 'mohin' },
  { name: 'laugh', emoji: '😂', text: '{a} se rió muchísimo con {b}', alias: 'reir' },
  { name: 'punch', emoji: '👊', text: '{a} le dio un puñetazo a {b}', alias: 'golpe' },
  { name: 'kick', emoji: '🦵', text: '{a} le dio una patada a {b}', alias: 'patada' },
  { name: 'kill', emoji: '🪓', text: '{a} eliminó a {b} del mapa', alias: 'matar' },
  { name: 'stare', emoji: '👁️', text: '{a} miró fijamente a {b}', alias: 'mirar' },
  { name: 'stare_glare', emoji: '😠', text: '{a} le lanzó una mirada asesina a {b}' },
  { name: 'feed', emoji: '🍡', text: '{a} le dio de comer a {b}', alias: 'alimentar' },
  { name: 'cook', emoji: '🍳', text: '{a} cocinó para {b}', alias: 'cocinar' },
  { name: 'tea', emoji: '🍵', text: '{a} compartió un té con {b}', alias: 'te' },
  { name: 'coffee', emoji: '☕', text: '{a} invitó un café a {b}', alias: 'cafe' },
  { name: 'cake', emoji: '🎂', text: '{a} le regaló un pastel a {b}', alias: 'pastel' },
  { name: 'flowers', emoji: '🌹', text: '{a} le regaló flores a {b}', alias: 'flores' },
  { name: 'gift', emoji: '🎁', text: '{a} le dio un regalo a {b}', alias: 'regalo' },
  { name: 'carry', emoji: '🫳', text: '{a} cargó a {b} en brazos', alias: 'cargar' },
  { name: 'protect', emoji: '🛡️', text: '{a} protegió a {b}', alias: 'proteger' },
  { name: 'comfort', emoji: '🫂', text: '{a} consoló a {b}', alias: 'consolar' },
  { name: 'scare', emoji: '👻', text: '{a} asustó a {b}', alias: 'asustar' },
  { name: 'chase', emoji: '🏃', text: '{a} persiguió a {b} por todo el grupo', alias: 'perseguir' },
  { name: 'wink_kiss', emoji: '😘', text: '{a} le tiró un beso volado a {b}' },
  { name: 'snuggle', emoji: '🛌', text: '{a} se acostó junto a {b}' },
  { name: 'cheer', emoji: '📣', text: '{a} animó a {b} con todas sus fuerzas', alias: 'animar' },
  { name: 'applaud', emoji: '👏', text: '{a} aplaudió a {b}', alias: 'aplaudir' },
  { name: 'bow', emoji: '🙇', text: '{a} se inclinó ante {b}', alias: 'reverencia' },
  { name: 'respect', emoji: '🫡', text: '{a} le mostró respeto a {b}', alias: 'respeto' },
  { name: 'photo', emoji: '📸', text: '{a} se tomó una foto con {b}', alias: 'foto' },
  { name: 'sleep', emoji: '😴', text: '{a} se quedó dormido junto a {b}', alias: 'dormir' },
  { name: 'wave', emoji: '👋', text: '{a} saludó a {b} con la mano', alias: 'saludar' },
];

/** Índice por nombre y alias, para resolver `.reaccion <tipo>`. */
export const REACTION_INDEX = new Map<string, ReactionDef>(
  REACTIONS.flatMap((reaction) => [
    [reaction.name, reaction] as [string, ReactionDef],
    ...(reaction.alias ? ([[reaction.alias, reaction]] as Array<[string, ReactionDef]>) : []),
  ]),
);
