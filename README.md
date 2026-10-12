# VÉRSOVA · plataforma de bots para WhatsApp

VÉRSOVA es una **plataforma** con panel web propio donde cada persona crea, configura y usa sus
bots de WhatsApp (SubBots). Incluye catálogo de bots **100 % gratis** (con repos abiertos en
GitHub), tienda sin costo, métricas y reportes que llegan al owner.

El motor es **multi-bot**: el bot de WhatsApp ejecuta el paquete que esté activo y cada bot del
catálogo vive en su propia carpeta del repositorio:

| Bot | Carpeta | Prefijo | Comandos |
|---|---|---|---|
| 👑 **VÉRSOVA** | `src/commands/` | `.` | 34 |
| ⚡ **Raiden WaBot** | `bots/raiden-wabot/` | `.` | 71 |
| 🎧 **Yae Miku Bot** | `bots/yae-miku-bot/` | `.` | 8 |

Los paquetes de `bots/` comparten utilidades en `bots/shared/` (almacén, texto, enlaces, HTTP,
antilink, sociales y medios) y se cargan con el motor de `src/core/bot-packs.ts`.

- Prefijo: `.` (configurable en el panel)
- Idioma: español
- Web: `/` portada · `/registrar` crear bot · `/bots` mis bots · `/metrics` monitor · `/store` tienda
  y catálogo · `/cmds` catálogo de comandos · `/links` enlaces · `/menu` menú · `/ticket` soporte

## Estado actual

**Plataforma web**

- **Cuentas**: registro y acceso con email (demo) o **Google** (OAuth 2.0). Sesiones con cookie
  `HttpOnly` (`versova_session`, 30 días).
- **Catálogo de bots** (`/store`): **VÉRSOVA**, **Raiden WaBot** y **Yae Miku Bot**, todos
  **gratis (0 $)** y con enlace a su repo en GitHub. Cada tarjeta ofrece **«＋ Crear este bot»**
  (crea el SubBot de ese tipo y lo deja activo), **«⚡ Usar este bot»** (cambia el bot que
  responde ahora) y **«Registrar con asistente»** (`/registrar?bot=<slug>`, el asistente llega con
  el tipo de bot ya elegido).
- **Tienda de tokens, espacio y planes**: token Premium, token VIP, espacio extra (1 GB), plan
  Premium y plan VIP — **todo a 0 $**. El pago es demo: registra la compra, no cobra dinero real.
- **Soporte** (`/ticket`): los reportes se notifican al owner (WhatsApp +598 96 719 709 y
  lyanvalentinmail@gmail.com, configurables) con bandeja «Mis Envíos».
- **Registrar un SubBot** (`/registrar`): asistente de 6 pasos (bot → instancia → servidor →
  vinculación → nombre → confirmación) con QR de WhatsApp y **código de 8 dígitos**. El primer
  paso elige el paquete (VÉRSOVA, Raiden WaBot o Yae Miku Bot) o el catálogo; el resto del
  asistente es igual para todos.
- **Comandos por bot** (`/cmds`): pestañas por paquete; `/api/commands?bot=<slug>` y
  `/api/menu?bot=<slug>` devuelven el inventario y el menú de ese bot sin cambiar el activo.
- **Mis Bots** (`/bots`): sesiones activas, estado del socket, «Opciones del bot», grupos, métricas
  y acciones (reiniciar, pausar, reanudar, detener, desvincular, eliminar). Cada tarjeta muestra el
  paquete del SubBot y, si no es el que responde, el botón **«⚡ Usar bot»** lo activa;
  `/api/status` publica el paquete activo.
- **Bots editables**: nombre corto, nombre largo, moneda, dueño (número), enlace del bot, canal de
  WhatsApp, prefijos (`/ # ! + - . * ~`), banner, usuario, estado, avatar e instancia.
- **Monitor del sistema** (`/metrics`): CPU, memoria, disco, red, latencia y datos del proceso por
  servidor, con actualización en vivo.
- **Panel del bot**: banner, catálogo de comandos con categorías, alias, activar/desactivar y
  ocultar, vista previa del menú, telemetría y logs en vivo por SSE.
- Tema claro/oscuro con preferencia guardada.

**Comandos de WhatsApp (34, todos implementados)**

| Categoría | Comandos |
|---|---|
| Registro | `.reg`, `.unreg`, `.editar`, `.ficha`, `.rol`, `.roles`, `.mirol`, `.cambiarol`, `.reservar`, `.liberar`, `.resetrol`, `.acceptrol`, `.denyrol` |
| General | `.menu` |
| Gestión | `.team`, `.miembros`, `.afk`, `.inactivos`, `.reglas`, `.admins` |
| Personajes | `.perfil`, `.pareja`, `.aceptar`, `.rechazar`, `.ship` |
| Interacción | `.anuncio` |
| Administración | `.add`, `.expulsar`, `.ban`, `.unban`, `.warn`, `.unwarn`, `.close`, `.open` |

El menú (`.menu`) agrupa los comandos por bloques. El panel los marca como **implementado**,
permite desactivarlos, ocultarlos o crear alias, todo **por paquete**: los ajustes de VÉRSOVA y de
los bots de `bots/` se guardan por separado (`command-settings[:<paquete>]`).

**Comandos de los bots del catálogo** (se ejecutan cuando ese bot está activo)

| Bot | Comandos | Notas |
|---|---|---|
| Raiden WaBot | **Descargas**: `.download`, `.play`, `.yt`, `.ig`, `.spotify`, `.tiktok`, `.xdl`<br>**Stickers e imágenes**: `.sticker`, `.brat`, `.logo`, `.foto`/`.photo`<br>**IA**: `.ai`<br>**Reacciones**: `.reacciones`, `.reaccion` + 45 reacciones (`hug`, `kiss`, `pat`, `slap`, `cuddle`, `poke`…)<br>**Rol y moderación**: `.menu`, `.perfil`, `.marry`, `.divorce`, `.ship`, `.work`, `.top`, `.cumple`, `.ping`, `.tagall`, `.kick`, `.antilink`, `.mute`, `.unmute` | Stickers y logos usan `sharp` opcional; `.ai` necesita `AI_API_KEY`; las descargas usan `DOWNLOAD_API_URL` opcional |
| Yae Miku Bot | `.menu`, `.marry`, `.divorce`, `.profile`, `.top`, `.config`, `.subbots`, `.antilink` | Matrimonio con propuesta por respuesta «sí»/«no», antilink y sub-bots persistentes |

## Cuentas e inicio de sesión con Google

Para entrar al panel (`/bots`, `/registrar`, `/store`, `/metrics`, `/ticket`) hay que **iniciar
sesión o registrarse**.

- **Con Google**: define `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET` de un proyecto en
  [Google Cloud Console](https://console.cloud.google.com/apis/credentials) (tipo *OAuth client ID*
  → *Web application*). En *Authorized redirect URIs* agrega
  `https://TU-DOMINIO/api/auth/google/callback` (en local:
  `http://localhost:3000/api/auth/google/callback`). El botón «Continuar con Google» se activa solo
  cuando esas variables existen.
- **Con email (demo)**: registro y acceso con email y contraseña (hash scrypt). Es la vía por
  defecto para probar sin configurar Google; usa `DEMO_LOGIN=0` para desactivarla.
  La cuenta de demostración es `demo@versova.app` / `versova`.

## Catálogo de bots (todo gratis, 0 $)

- **VÉRSOVA**: el bot de rol propio de la plataforma (menú, registro, personajes, advertencias y
  todos los comandos). Enlace: [versova-project](https://github.com/lyanvalentinmail-prog/versova-project).
- **Raiden WaBot**: bot anime abierto en GitHub — descargas (Instagram, YouTube, Spotify, TikTok),
  stickers (estilo BRAT y Sticker.ly), más de 40 reacciones anime, IA conversacional y logos.
  Enlace: [Raiden-WaBot](https://github.com/Ryuzei-Ts/Raiden-WaBot).
- **Yae Miku Bot**: bot de rol y moderación abierto en GitHub (MIT) — matrimonio/divorcio con
  pareja visible en el perfil, antilink y sub-bots persistentes. Enlace:
  [Yae-Miku-Bot](https://github.com/Abrahan987/Yae-Miku-Bot).

El catálogo se usa de tres formas:

- **＋ Crear este bot** (`POST /api/catalog/:slug/create`): crea el SubBot de ese tipo (mismos
  límites del plan que cualquier alta), lo liga a la cuenta, marca el uso en `catalog_uses` y lo
  deja **activo**.
- **⚡ Usar este bot** (`POST /api/bots/:slug/activate`): cambia el paquete que responde sin crear
  nada; la elección se guarda en `settings` (`active-bot`) y sobrevive al reinicio.
- **Registrar con asistente** (`/registrar?bot=<slug>`): el asistente arranca con ese tipo de bot
  elegido; también se puede cambiar el paquete después desde «Opciones del bot» o `/bots`.

`GET /api/bots` lista los paquetes implementados y cuál está activo. El tipo de bot se valida con
`AVAILABLE_BOT_TYPES` (VÉRSOVA, Raiden WaBot, Yae Miku Bot); un tipo inventado responde 400.

**Carpetas** (así se implementan «en una carpeta en GitHub»):

```
bots/
  shared/           utilidades comunes (store, texto, enlaces, http, antilink, social, media)
  raiden-wabot/     pack.ts, brand.ts, lib/reactions.ts y commands/ (10 módulos)
  yae-miku-bot/     pack.ts, brand.ts, commands/ y guards/
```

Cada carpeta exporta un `BotPack` (slug, nombre, emoji, carpeta, enlace, prefijos, comandos y
guards) que `src/bots/index.ts` registra al arrancar. Para añadir otro bot del catálogo basta con
crear su carpeta, exportar el paquete y sumarlo a `src/bots/index.ts` y a `BOT_CATALOG`.

## Tienda, tokens y SubBots

- Comprar un **token** entrega el código al instante (`VRSOV-PREM-XXXX-XXXX` / `VRSOV-VIP-…`), queda
  en «Mis tokens» y se canjea **una sola vez** al crear un SubBot de su mismo tipo.
- El **espacio extra** (1 GB = 0 $) entra al pool de la cuenta y se reparte entre los bots.
- Los planes son Free, Premium y VIP, **todos a 0 $**: Free (1 GB por bot · 3 bots), Premium
  (2 GB · 5 bots) y VIP (4 GB · 10 bots).
- Las **opciones del bot** (nombre corto/largo, moneda, dueño, enlace, canal, prefijos, banner,
  usuario, estado, avatar, instancia y servidor) se editan desde «Opciones del bot» y se guardan en
  `subbots`.

## Requisitos

- Node.js 22 o superior.
- PostgreSQL **opcional**: sin `DATABASE_URL` la plataforma arranca en **modo memoria** (todo
  funciona, pero los datos se pierden al reiniciar). Para producción se recomienda Neon.
- Un número de WhatsApp dedicado por bot.

## Configuración local

```bash
cp .env.example .env   # completa OWNER_NUMBERS (y DATABASE_URL si usas PostgreSQL)
npm ci
npm run build
npm start
```

Abre `http://localhost:3000`. Sin `DATABASE_URL`, la consola avisa que está en modo memoria.

Para desarrollo con recarga automática: `npm run dev`.

Variables:

| Variable | Uso |
|---|---|
| `DATABASE_URL` | URL PostgreSQL (Neon pooled, con `sslmode=require`). Si falta, modo memoria. |
| `DB_SSL` | `true` para Neon y otras bases con SSL; `false` en local. |
| `OWNER_NUMBERS` | Números del propietario, con código de país, separados por coma. |
| `OWNER_EMAIL` | Email del propietario; a él llegan los tickets. Por defecto `lyanvalentinmail@gmail.com`. |
| `BOT_PHONE` | Opcional: número del bot para pedir un código de emparejamiento al arrancar. |
| `GOOGLE_CLIENT_ID` | Opcional: activa «Continuar con Google» en el acceso. |
| `GOOGLE_CLIENT_SECRET` | Opcional: secreto OAuth de Google (junto al ID). |
| `MAIL_HOST` / `MAIL_USER` / `MAIL_PASS` | Opcional: SMTP para avisar al owner por email cuando llega un ticket. Sin él, solo WhatsApp. |
| `MAIL_PORT` / `MAIL_SECURE` / `MAIL_FROM` | Ajustes opcionales del SMTP (587 / `false` / remitente). |
| `DEMO_LOGIN` | `0` desactiva el acceso con email y deja solo Google. Por defecto activado. |
| `BOT_TYPE` | Paquete que responde por defecto al arrancar (`versova`, `raiden`, `yae-miku`). Luego manda lo elegido en el panel. |
| `BOT_ALLOW_NETWORK` | `0` desactiva cualquier petición externa de los bots (descargas, metadatos e IA). |
| `DOWNLOAD_API_URL` | Opcional: API de descargas estilo Cobalt para `.download`/`.play` de Raiden. |
| `AI_API_KEY` / `AI_BASE_URL` / `AI_MODEL` / `AI_MAX_TOKENS` | Opcionales: proveedor compatible con OpenAI para `.ai` de Raiden (por defecto `gpt-4o-mini`). |
| `PORT` | Puerto HTTP (Render asigna su propio valor). |

## API

Rutas públicas: `/`, `/cmds`, `/links`, `/menu`, `/health`, `/api/platform`, `/api/catalog`,
`/api/bots`, `/api/servers`, `/api/status`, `/api/system`, `/api/metrics`, `/api/banner`,
`/api/commands`, `/api/menu` y `/api/logs/stream` (SSE). `/home` redirige a `/` y `/status` a
`/metrics`.

Rutas con sesión: `/api/auth/*`, `/api/store/catalog`, `/api/store/checkout`, `/api/store/tokens`,
`/api/subbots` (opciones, acciones, grupos, emparejamiento y confirmación), `/api/reports`
(notifica al owner) y las del catálogo.

Catálogo y paquetes:

| Método y ruta | Qué hace |
|---|---|
| `GET /api/bots` | Paquetes implementados (`slug`, nombre, emoji, carpeta, enlace, nº de comandos) y cuál está activo. |
| `POST /api/bots/:slug/activate` | Cambia el bot que responde. Con `{"subbotId": 12}` la elección queda ligada a ese SubBot (es lo que hace «⚡ Usar bot» en `/bots`); un SubBot de otra cuenta responde 404. |
| `POST /api/catalog/:slug/create` | **Crear este bot**: crea el SubBot de ese tipo, marca el uso y lo activa. Devuelve 201 con `catalog`, `bot`, `botType` y `message`. |
| `POST /api/catalog/:slug/use` | Marca el uso del bot del catálogo en la cuenta (equivale a activarlo sin crear SubBot). |
| `GET /api/commands?bot=<slug>` | Inventario de comandos de un paquete (`implemented`, categoría, alias) sin cambiar el activo. |
| `GET /api/menu?bot=<slug>` | Menú renderizado (texto) de un paquete. |

`GET /api/catalog` añade por bot `implemented`, `folder`, `botType`, `totalCommands`, `ownCommands`,
`active`, `owned` y `subbotId`. `POST /api/subbots` y `GET /api/subbots` aceptan y devuelven
`botType`/`botTypes`; al confirmar el emparejamiento la respuesta incluye `activeBot`.

## Pruebas

```bash
npm test                                   # suite completa (modo memoria)
TEST_DATABASE_URL=postgres://... npm test   # además, pruebas de PostgreSQL
```

Además de las pruebas unitarias, la suite incluye estas verificaciones de conjunto:

- **Prueba de humo de los 34 comandos** (`tests/commands-run.test.ts`): cada comando se ejecuta con
  una base simulada y debe responder sin caer en el error genérico.
- **Esquema y repositorios** (`tests/schema.test.ts`): aplica el esquema completo y siembra los
  catálogos sobre un emulador de PostgreSQL (pg-mem) y ejercita los repositorios reales.
- **Páginas en el navegador** (`tests/pages.test.ts`): abre cada página con jsdom, con la API
  simulada, y comprueba que se dibujan sin errores de JavaScript.
- **Bots del catálogo** (`tests/bots.test.ts`): ejecuta los comandos de Raiden WaBot y Yae Miku Bot
  (herencia y sobrescritura de comandos del núcleo, menús, matrimonio con propuesta, antilink,
  reacciones, sub-bots y guardas) y comprueba que un paquete inactivo no corre sus guardas.
- **Panel y paquetes** (`tests/web.test.ts`): cubre `/api/bots`, `/api/commands?bot=`,
  `/api/menu?bot=`, `/api/catalog` y el flujo `raiden/create` → activo → emparejamiento →
  `yae-miku/create`.

Las pruebas de base de datos reales (`db`, `web-auth`) solo corren con `TEST_DATABASE_URL` y vacían
datos: usa una base dedicada.

## Base de datos

El esquema (`src/database/schema.ts`, versión 6) cubre cuentas y sesiones web, tokens, subbots con
todas sus opciones, catálogo de bots (con enlace a GitHub) y usos, servidores, grupos de cada
subbot, reportes y el almacén clave/valor de los bots (`bot_data`, con clave
`(group_id, wa_id, key)`: economía, matrimonios, cumpleaños, niveles de antilink, etc.). Las
migraciones se aplican al arrancar; en modo memoria se siembran los mismos datos en RAM.

### Neon (plan gratuito)

El plan Free de [Neon](https://neon.com/pricing) alcanza para empezar (1 GB y 100 CU-horas
mensuales). Copia la **pooled connection string** en `DATABASE_URL` con `DB_SSL=true` y mantenla como
variable secreta del despliegue. Revisa los límites vigentes: pueden cambiar.

### Despliegue en Render

1. Crea la base en Neon y copia la URL.
2. Crea un *Blueprint* o *Web Service* desde este repositorio (`render.yaml` ya define build, start
   y health check).
3. Completa `DATABASE_URL`, `OWNER_EMAIL` y, si quieres, `BOT_PHONE`.
4. Abre la URL pública y vincula WhatsApp con QR o código.

**Limitaciones del plan gratuito de Render**: el servicio se duerme tras 15 minutos sin tráfico (la
conexión de WhatsApp se interrumpe) y el disco es efímero; por eso la sesión y los datos viven en
PostgreSQL.

## Emparejamiento por código

El panel pide el código solo cuando WhatsApp puede aceptarlo y lo confirma antes de mostrarlo:

- El botón se habilita cuando la conexión entra en modo vinculación (junto con el QR).
- El código vive ~60 segundos; el panel muestra la cuenta regresiva y lo quita al expirar.
- Si WhatsApp rechaza la solicitud, el panel muestra el motivo en vez de un código inútil.
- Se pide **un solo código por conexión**. Con `BOT_PHONE` el pedido automático ocurre una vez, no
  en cada renovación del QR.
- Las credenciales provisionales no se guardan: un intento abandonado no rompe el siguiente arranque.

## Personalización desde el panel

- Texto e imagen del banner que aparece antes del menú.
- Texto decorativo antes de cada comando (por defecto `ㅤ୨ৎㅤ.`).
- Activar/desactivar comandos, ocultarlos y crear alias.
- Vista previa del menú antes de enviarlo.

Los ajustes se guardan en la base (o en memoria) y se conservan al reiniciar el servicio.

## Limitaciones de WhatsApp

- Baileys es una librería no oficial: su uso puede violar los términos de WhatsApp y provocar el
  bloqueo del número. Usa un número dedicado.
- El bot necesita ser administrador del grupo para expulsar, añadir o cerrar/abrir el grupo.
- `.add` depende de la privacidad del usuario; si WhatsApp no permite añadirlo, no hay forma de
  forzarlo.
- WhatsApp migra identificadores de número a LID. Se guardan tal como llegan.
- La inactividad solo se conoce desde que el bot vio al integrante.

## Estructura

```
src/
  config/        configuración y valores por defecto
  core/          conexión WhatsApp, router, paquetes de bots, guardas, permisos y ajustes
  database/      esquema, repositorios PostgreSQL, capa en memoria y semillas
  commands/      comandos de VÉRSOVA en archivos por categoría, catálogo y menú
  bots/          carga y registro de los paquetes de bots/
  events/        mensajes entrantes, entradas y salidas del grupo
  services/      reglas compartidas (desregistro, sincronización)
  messages/      diseño de mensajes de VÉRSOVA
  utils/         texto, tiempo, logs, límites de uso
  web/           servidor, autenticación, datos de la plataforma y páginas públicas
bots/
  shared/        utilidades comunes de los bots del catálogo
  raiden-wabot/  paquete ⚡ Raiden WaBot (comandos, reacciones y guardas)
  yae-miku-bot/  paquete 🎧 Yae Miku Bot (comandos y guardas)
tests/
```
