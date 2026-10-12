import { registerPack, type BotPack } from '../../src/core/bot-packs.js';
import { registerAntilinkGuard, registerActivityGuard, registerMuteGuard } from '../shared/antilink.js';
import { YAE } from './brand.js';

/** Ficha del pack Yae Miku Bot (se registra antes de cargar sus comandos). */
export const YAE_PACK: BotPack = {
  slug: YAE.slug,
  aliases: ['yae-miku', 'yae', 'yaemiku', 'yae-miku-bot', 'miku'],
  name: YAE.name,
  emoji: YAE.emoji,
  tagline: YAE.tagline,
  description:
    'Bot de WhatsApp abierto (MIT): matrimonio y divorcio con la pareja visible en el perfil, antilink que borra los enlaces y expulsa a quien insiste, sub-bots persistentes que se restauran al conectar y configuración del grupo por chat.',
  category: 'Juegos',
  accent: '#22d3ee',
  link: 'https://github.com/Abrahan987/Yae-Miku-Bot',
  prefix: '.',
  folder: 'bots/yae-miku-bot',
  features: [
    'Matrimonio y divorcio con pareja visible en el perfil',
    'Antilink: borra enlaces y expulsa al que los envíe',
    'Sub-bots persistentes: se restauran al reconectar',
    'Configuración del grupo por chat (.config)',
    'Ranking de actividad de los integrantes',
    'Licencia MIT: el código vive en bots/yae-miku-bot',
  ],
  highlights: ['marry', 'divorce', 'antilink', 'config', 'profile', 'subbots', 'top'],
};

registerPack(YAE_PACK);

// Guardias: moderación y contador de actividad.
registerAntilinkGuard(YAE_PACK.slug, { name: 'yae-antilink', brand: YAE.brand });
registerMuteGuard(YAE_PACK.slug, { name: 'yae-mute', brand: YAE.brand });
registerActivityGuard(YAE_PACK.slug, { name: 'yae-activity', key: 'yae_msgs' });
