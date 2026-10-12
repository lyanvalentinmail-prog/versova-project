/**
 * 🎧 Yae Miku Bot — bot de rol y moderación del catálogo.
 *
 * `./pack.js` registra la ficha y las guardias antes de que se carguen los
 * comandos, que llaman a `registerPackCommand` al importarse.
 */
import './pack.js';
import './commands/menu.js';
import './commands/social.js';
import './commands/config.js';
import './commands/antilink.js';
import './commands/subbots.js';
import './guards/marriage.js';

export { YAE_PACK } from './pack.js';
export { YAE } from './brand.js';
