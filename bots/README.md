# `bots/` · los bots del catálogo

Cada bot del catálogo vive en **su propia carpeta** dentro de `bots/`. La plataforma ejecuta un
solo bot de WhatsApp por conexión: el que esté activo (se elige desde la tienda, `/bots` o el
asistente `/registrar`). Los comandos del núcleo viven en `src/commands/` y forman el pack base
`versova`; los demás packs los heredan y solo aportan lo suyo.

```
bots/
  shared/          utilidades comunes (store, texto, enlaces, http, antilink, social, media)
  versova/         ficha del bot base (sus comandos están en src/commands/)
  raiden-wabot/    ⚡ Raiden WaBot  · descargas, stickers, IA, reacciones y logos
  yae-miku-bot/    🎧 Yae Miku Bot  · matrimonio, antilink, sub-bots y configuración
```

## Qué exporta cada carpeta

| Archivo | Contenido |
|---|---|
| `pack.ts` | La ficha del bot (`BotPack`): slug, alias, nombre, emoji, tagline, descripción, categoría, color, enlace al repo, prefijo, `folder`, características y comandos destacados. Llama a `registerPack(...)`. |
| `index.ts` | Importa `./pack.js` **primero** y después cada archivo de `commands/` (y `guards/`). Es el único punto que el motor importa desde `src/bots/index.ts`. |
| `commands/*.ts` | Los comandos propios, registrados con `registerPackCommand(slug, …)`. Si un comando se llama igual que uno del núcleo (por ejemplo `.menu` o `.perfil`), gana el del pack. |
| `guards/*.ts` | Guardias que se ejecutan en **cada** mensaje del grupo cuando ese bot está activo (antilink, matrimonio, mute, actividad…). Se registran con `registerGuard`. |
| `brand.ts` / `lib/` | Textos, firmas y ayudantes privados del bot. |

## Contrato de un comando

```ts
import { registerPackCommand, type Command } from '../../src/core/bot-packs.js';

const ping: Command = {
  name: 'ping',
  category: 'General',
  usage: '.ping',
  description: 'Responde «pong».',
  groupOnly: false,
  run: async (ctx) => {
    await ctx.reply(`pong · ${ctx.pack}`);
  },
};

registerPackCommand('mi-bot', ping);
```

- `ctx` trae el socket, el mensaje, el grupo, el remitente, los argumentos, los permisos
  (`isAdmin`, `botIsAdmin`, `isOwner`) y `ctx.pack` (el bot que está resolviendo el mensaje).
- `groupOnly`, `adminOnly`, `ownerOnly` y `needsBotAdmin` los aplica el router antes de `run`.
- Para datos persistentes usa `bots/shared/store.ts` (clave/valor por `(grupo, usuario, clave)` en
  `bot_data`) y `bots/shared/antilink.ts`, `social.ts` y `media.ts` para las reglas comunes.

## Añadir otro bot del catálogo

1. Copia una carpeta existente (`bots/yae-miku-bot/` es la más pequeña) con el slug del bot nuevo.
2. Ajusta `pack.ts` (slug, alias, enlace y `folder`) y escribe sus `commands/`.
3. Súmalo a `src/bots/index.ts` con un `import '../bots/<slug>/index.js';` y a `src/bots/index.ts`
   en la lista de packs (la carga es por import, no hace falta tocar el resto del motor).
4. Agrega su ficha a `BOT_CATALOG` en `src/web/platform-data.ts` (nombre, emoji, enlace de GitHub,
   categoría, características y `commands`).

El panel, `/api/bots`, `/api/commands?bot=<slug>`, `/api/menu?bot=<slug>` y el asistente
`/registrar?bot=<slug>` reconocen el bot nuevo automáticamente: las rutas se arman con
`packSummaries()`, así que no hay listas duplicadas que mantener.

## Comprobar que funciona

```bash
npm run build && npm start
curl -s localhost:3000/api/bots                       # los packs y cuál está activo
curl -s "localhost:3000/api/commands?bot=raiden"      # el inventario del bot (acepta alias)
curl -s "localhost:3000/api/menu?bot=yae-miku"        # el menú tal como lo envía
curl -s -X POST localhost:3000/api/catalog/raiden/create   # crear ese bot (con sesión)
```

En la suite: `tests/bots.test.ts` ejecuta los comandos y las guardias de cada pack, y
`tests/pages.test.ts` comprueba que el asistente preselecciona el bot pedido (`?bot=`) y que la
tienda ofrece «＋ Crear este bot».
