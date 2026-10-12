/**
 * ⚡ Raiden WaBot — bot anime del catálogo.
 *
 * El orden de estos `import` importa: `./pack.js` registra la ficha del bot y sus
 * guardias antes de que los comandos se registren en el pack.
 */
import './pack.js';
import './commands/menu.js';
import './commands/ping.js';
import './commands/download.js';
import './commands/sticker.js';
import './commands/ai.js';
import './commands/logo.js';
import './commands/reactions.js';
import './commands/social.js';
import './commands/moderation.js';
import './commands/profile.js';

export { RAIDEN_PACK } from './pack.js';
export { RAIDEN } from './brand.js';
export { REACTIONS } from './lib/reactions.js';
