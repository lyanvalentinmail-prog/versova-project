# VÉRSOVA · plataforma de bots para WhatsApp

VÉRSOVA es una **plataforma** con panel web propio donde cada persona crea, configura y usa sus
bots de WhatsApp (SubBots). Incluye catálogo de bots **gratis y de pago**, economía interna con
**V-Coins**, tienda, métricas y reportes. El bot de WhatsApp ejecuta **41 comandos** con prefijo `.`.

- Prefijo: `.` (configurable en el panel)
- Idioma: español
- Web: `/` portada · `/registrar` crear bot · `/bots` mis bots · `/metrics` monitor · `/store` tienda
  y catálogo · `/cmds` catálogo de comandos · `/links` enlaces · `/menu` menú · `/ticket` soporte

## Estado actual

**Plataforma web**

- **Cuentas**: registro y acceso con email (demo) o **Google** (OAuth 2.0). Sesiones con cookie
  `HttpOnly` (`versova_session`, 30 días).
- **Catálogo de bots** (`/store`): 12 bots con precio **gratis**, **en V-Coins** o **en USD**
  (VÉRSOVA, Moderador, Economía, IA, Música, Juegos, Stickers, Descargas, Bienvenidas, Encuestas,
  Ventas, Auditoría). Activar un bot de catálogo lo deja ligado a la cuenta y a uno de sus SubBots.
- **Economía**: monedero de **V-Coins 🪙**, bono diario, 6 misiones con recompensa, tienda interna
  (7 objetos) y compra de bots con monedas. Todo movimiento queda en el libro de movimientos.
- **Tienda de tokens y espacio**: token Premium ($1), token VIP ($5), espacio extra (1 GB = $1),
  planes y packs de monedas. El pago es demo: registra la compra, no cobra dinero real.
- **Registrar un SubBot** (`/registrar`): asistente de 6 pasos (token → instancia → servidor →
  vinculación → nombre → confirmación) con QR de WhatsApp y **código de 8 dígitos**.
- **Mis Bots** (`/bots`): sesiones activas, estado del socket, «Opciones del bot», grupos, métricas
  y acciones (reiniciar, pausar, reanudar, detener, desvincular, eliminar).
- **Bots editables**: nombre corto, nombre largo, moneda, dueño (número), enlace del bot, canal de
  WhatsApp, prefijos (`/ # ! + - . * ~`), banner, usuario, estado, avatar e instancia.
- **Monitor del sistema** (`/metrics`): CPU, memoria, disco, red, latencia y datos del proceso por
  servidor, con actualización en vivo.
- **Reportes y sugerencias** (`/ticket`): envío y bandeja «Mis Envíos».
- **Panel del bot**: banner, catálogo de comandos con categorías, alias, activar/desactivar y
  ocultar, vista previa del menú, telemetría y logs en vivo por SSE.
- Tema claro/oscuro con preferencia guardada.

**Comandos de WhatsApp (41, todos implementados)**

| Categoría | Comandos |
|---|---|
| Registro | `.reg`, `.unreg`, `.editar`, `.ficha`, `.rol`, `.roles`, `.mirol`, `.cambiarol`, `.reservar`, `.liberar`, `.resetrol`, `.acceptrol`, `.denyrol` |
| General | `.menu` |
| Equipo | `.team`, `.miembros`, `.afk`, `.inactivos` |
| Social | `.perfil`, `.pareja`, `.aceptar`, `.rechazar`, `.ship`, `.reglas`, `.admins` |
| Administración | `.add`, `.expulsar`, `.ban`, `.unban`, `.warn`, `.unwarn`, `.anuncio`, `.close`, `.open` |
| Economía | `.coins`, `.daily`, `.work`, `.robar`, `.rank`, `.tienda`, `.comprar` |

El menú (`.menu`) agrupa los comandos en seis bloques (𝟎𝟏 Registro → 𝟎𝟔 Economía). El panel los
marca como **implementado**, permite desactivarlos, ocultarlos o crear alias.

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

## Economía y catálogo

- **V-Coins**: se ganan con `.daily` (40–100 según racha), `.work` (cada 15 min), `.robar`
  (45 % de éxito, con multa si falla) y en el panel con el bono diario y las misiones.
- **Tienda interna** (`.tienda` / `.comprar <id>`): espacio extra 1 GB (300), token Premium (700),
  token VIP (2500), plan Premium (1200), plan VIP (4000), pack de banners (150), pack de prefijos
  (250).
- **Catálogo de bots**: cada bot tiene precio, acento, popularidad y descripción. Los gratuitos se
  activan al instante; los de V-Coins descuentan el saldo; los de USD pasan por la tienda.
- **Compras en el panel**: los packs de monedas (`coins-500`, `coins-1600`, `coins-4500`) acreditan
  V-Coins al instante.

## Tienda, tokens y SubBots

- Comprar un **token** entrega el código al instante (`VRSOV-PREM-XXXX-XXXX` / `VRSOV-VIP-…`), queda
  en «Mis tokens» y se canjea **una sola vez** al crear un SubBot de su mismo tipo.
- El **espacio extra** (1 GB = $1) entra al pool de la cuenta y se reparte entre los bots.
- Los planes son Free ($0 · 1 GB por bot · 3 bots), Premium ($1 · 2 GB · 5 bots) y VIP ($5 · 4 GB ·
  10 bots).
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
| `BOT_PHONE` | Opcional: número del bot para pedir un código de emparejamiento al arrancar. |
| `GOOGLE_CLIENT_ID` | Opcional: activa «Continuar con Google» en el acceso. |
| `GOOGLE_CLIENT_SECRET` | Opcional: secreto OAuth de Google (junto al ID). |
| `DEMO_LOGIN` | `0` desactiva el acceso con email y deja solo Google. Por defecto activado. |
| `PORT` | Puerto HTTP (Render asigna su propio valor). |

## API

Rutas públicas: `/`, `/cmds`, `/links`, `/menu`, `/health`, `/api/platform`, `/api/catalog`,
`/api/servers`, `/api/status`, `/api/system`, `/api/metrics`, `/api/banner`, `/api/commands`,
`/api/menu` y `/api/logs/stream` (SSE). `/home` redirige a `/` y `/status` a `/metrics`.

Rutas con sesión: `/api/auth/*`, `/api/economy` (`/daily`, `/mission`, `/buy`), `/api/store/catalog`,
`/api/store/checkout`, `/api/store/tokens`, `/api/subbots` (opciones, acciones, grupos,
emparejamiento y confirmación), `/api/reports` y `/api/catalog/:slug/use`.

## Pruebas

```bash
npm test                                   # suite completa (modo memoria)
TEST_DATABASE_URL=postgres://... npm test   # además, pruebas de PostgreSQL
```

Además de las pruebas unitarias, la suite incluye tres verificaciones de conjunto:

- **Prueba de humo de los 41 comandos** (`tests/commands-run.test.ts`): cada comando se ejecuta con
  una base simulada y debe responder sin caer en el error genérico.
- **Esquema y repositorios** (`tests/schema.test.ts`): aplica el esquema completo y siembra los
  catálogos sobre un emulador de PostgreSQL (pg-mem) y ejercita los repositorios reales.
- **Páginas en el navegador** (`tests/pages.test.ts`): abre cada página con jsdom, con la API
  simulada, y comprueba que se dibujan sin errores de JavaScript.

Las pruebas de base de datos reales (`db`, `web-auth`) solo corren con `TEST_DATABASE_URL` y vacían
datos: usa una base dedicada.

## Base de datos

El esquema (`src/database/schema.ts`, versión 4) cubre cuentas y sesiones web, tokens, subbots con
todas sus opciones, catálogo de bots y usos, economía (libro de movimientos, objetos, misiones),
banco por grupo, servidores, grupos de cada subbot y reportes. Las migraciones se aplican al
arrancar; en modo memoria se siembran los mismos datos en RAM.

### Neon (plan gratuito)

El plan Free de [Neon](https://neon.com/pricing) alcanza para empezar (1 GB y 100 CU-horas
mensuales). Copia la **pooled connection string** en `DATABASE_URL` con `DB_SSL=true` y mantenla como
variable secreta del despliegue. Revisa los límites vigentes: pueden cambiar.

### Despliegue en Render

1. Crea la base en Neon y copia la URL.
2. Crea un *Blueprint* o *Web Service* desde este repositorio (`render.yaml` ya define build, start
   y health check).
3. Completa `DATABASE_URL`, `OWNER_NUMBERS` y, si quieres, `BOT_PHONE`.
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
  core/          conexión WhatsApp, router, aliases, permisos y ajustes
  database/      esquema, repositorios PostgreSQL, capa en memoria y semillas
  commands/      comandos en archivos por categoría, catálogo y menú
  events/        mensajes entrantes, entradas y salidas del grupo
  services/      reglas compartidas (desregistro, sincronización)
  messages/      diseño de mensajes de VÉRSOVA
  utils/         texto, tiempo, logs, límites de uso
  web/           servidor, autenticación, datos de la plataforma y páginas públicas
tests/
```
