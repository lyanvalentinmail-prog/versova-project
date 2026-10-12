# VÉRSOVA · bot de WhatsApp para teams de rol

Bot de WhatsApp para administrar teams de rol. Prefijo `.` · Versión 1.0 · Idioma español.

## Estado actual

**Implementado**

- Conexión con WhatsApp (QR y código de emparejamiento), reconexión automática y sesión guardada en PostgreSQL.
- Interfaz web de cuatro rutas (`/` presentación, `/home` panel, `/store` tienda, `/cmds` catálogo) con estética oscura tipo plataforma de SubBots.
- **Cuentas de usuario**: inicio de sesión o registro obligatorio para entrar al panel y a la tienda. Acceso con **Google** (OAuth 2.0) o con email y contraseña (acceso demo, se puede desactivar). Sesiones con cookie httpOnly guardadas en PostgreSQL.
- **Menú de pestañas con 3 líneas**: en la portada, la tienda y el catálogo, un botón de 3 líneas (hamburguesa) abre las pestañas del sitio; en el panel abre el cajón lateral con todas las secciones.
- **Tienda** (`/store`): tokens **Premium ($1)** y **VIP ($5)** con entrega instantánea del código, **espacio extra (1 GB = $1)** para repartir entre bots, activación de **planes** y otros tipos de bots marcados como *Próximamente*. El pago es demo: no se cobra nada real.
- **Sub-bots**: cada usuario crea y edita sus sub-bots por tipo — **Free (1 GB)**, **Premium (2 GB)** y **VIP (4 GB)**; los premium/vip exigen canjear el código de un token de la tienda (un solo uso). El espacio por bot es el mayor entre el tipo y el plan, y se le suma el espacio extra comprado que asignes.
- **Planes**: Free ($0 · 1 GB por bot · hasta 3 bots), Premium ($1 · 2 GB por bot · hasta 5 bots) y VIP ($5 · 5 GB por bot · hasta 10 bots).
- **Pestaña «Mis Sub-Bots»** en el panel: crear, editar (nombre, número, descripción, espacio extra asignado, pausar/activar) y eliminar bots, con el límite y el plan de la cuenta siempre visibles.
- Panel: estado del bot, QR, emparejamiento en 4 pasos, cerrar sesión de WhatsApp, banner, lista de comandos con categorías, alias, activación/desactivación, vista previa del menú, telemetría real del servidor (CPU, RAM, disco, latencia de PostgreSQL) y logs en vivo por SSE.
- Tema claro/oscuro con selector animado y preferencia guardada en el navegador.
- Registro: `.reg`, `.unreg`, `.editar`, `.ficha`.
- Personajes: `.rol`, `.roles`, `.mirol`, `.cambiarol`, `.reservar`, `.liberar`.
- Administración de personajes: `.resetrol`, `.acceptrol` y `.denyrol`.
- `.menu` con el diseño VÉRSOVA solicitado. El panel permite ocultar comandos, desactivar los que ya tienen implementación y crear alias.
- Separación de datos por grupo, deduplicación de mensajes, límite de uso por usuario, auditoría de acciones administrativas y sincronización al salir del grupo.
- Actividad y AFK: registro de última actividad y avisos al mencionar a alguien AFK.

**Aún sin implementar**

`.team`, `.miembros`, `.afk` como comando, `.inactivos`, `.perfil`, `.pareja`, `.rechazar`, `.ship`, `.reglas`, `.admins`, `.add`, `.expulsar`, `.ban`, `.unban`, `.warn`, `.unwarn`, `.anuncio`, `.close` y `.open`.

El menú mantiene esas entradas porque forman parte del diseño pedido, pero el panel las marca como **Pendiente**. Los alias solo se pueden crear para comandos con implementación. Las secciones de código se organizan en archivos dentro de `src/commands/`.

## Cuentas e inicio de sesión con Google

Para entrar al panel (`/home`) y a la tienda (`/store`) hay que **iniciar sesión o registrarse**.

- **Con Google**: define `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET` de un proyecto en [Google Cloud Console](https://console.cloud.google.com/apis/credentials) (tipo *OAuth client ID* → *Web application*). En la lista de *Authorized redirect URIs* agrega `https://TU-DOMINIO/api/auth/google/callback` (en local: `http://localhost:3000/api/auth/google/callback`). El botón «Continuar con Google» queda activo solo cuando esas variables existen.
- **Con email (demo)**: registro y acceso con email y contraseña (hash scrypt en la base). Es la vía por defecto para probar sin configurar Google; pon `DEMO_LOGIN=0` para desactivarla y dejar solo Google.
- Las sesiones viven 30 días en la tabla `web_sessions` y viajan en una cookie `HttpOnly` (`versova_session`).

## Tienda, tokens y sub-bots

- Comprar un **token** entrega el código al instante (formato `VRSOV-PREM-XXXX-XXXX` / `VRSOV-VIP-…`), queda en «Mis tokens» y se canjea **una sola vez** al crear un sub-bot de su mismo tipo. Cada token queda ligado a la cuenta que lo compró.
- El **espacio extra** (1 GB = $1) entra al pool de la cuenta y se reparte entre los bots desde «Mis Sub-Bots».
- Los **otros tipos de bots** (música, juegos, IA, stickers) aparecen en la tienda como *Próximamente*: no se pueden comprar todavía.
- El pago es **demo**: registra la compra en el historial pero no cobra nada real. Puedes conectar tu pasarela de pagos en `POST /api/store/checkout`.

## Aviso importante: el panel exige cuenta

El panel y la tienda requieren iniciar sesión; la portada y el catálogo de comandos son públicos. Dentro de una sesión, quien tenga acceso a la cuenta puede cambiar el banner y el menú, desactivar comandos, consultar la actividad y usar los controles de WhatsApp (incluidos emparejamiento y cierre de sesión), así que no compartas tus credenciales.

Los cambios del panel se limitan por IP para reducir el abuso accidental, pero el límite no sustituye a la autenticación.

## Requisitos

- Node.js 22 o superior.
- PostgreSQL. Para un despliegue gratuito se recomienda Neon, compatible con el controlador PostgreSQL que ya usa el bot.
- Un número de WhatsApp dedicado para el bot.

## Configuración local

```bash
cp .env.example .env   # completa DATABASE_URL y OWNER_NUMBERS
npm ci
npm run build
npm start
```

Panel: `http://localhost:3000/home` (pide iniciar sesión). Portada: `http://localhost:3000`. Tienda: `http://localhost:3000/store`.

Variables:

| Variable | Uso |
|---|---|
| `DATABASE_URL` | URL PostgreSQL pooled de Neon, con `sslmode=require`. También acepta PostgreSQL local. |
| `DB_SSL` | `true` para Neon y otras bases con SSL; `false` solo en local. |
| `OWNER_NUMBERS` | Números del propietario, con código de país, separados por coma. |
| `BOT_PHONE` | Opcional: número del bot para pedir un código de emparejamiento al arrancar. |
| `GOOGLE_CLIENT_ID` | Opcional: activa «Continuar con Google» en el acceso. |
| `GOOGLE_CLIENT_SECRET` | Opcional: secreto OAuth de Google (junto al ID). |
| `DEMO_LOGIN` | `0` desactiva el acceso con email y deja solo Google. Por defecto activado. |
| `PORT` | Puerto HTTP (Render asigna su propio valor). |

## Emparejamiento por código

El panel pide el código solo cuando WhatsApp puede aceptarlo, y lo confirma con el servidor antes de mostrarlo:

- El botón se habilita cuando la conexión entra en modo vinculación (aparece junto con el QR). Antes de eso WhatsApp rechaza cualquier solicitud.
- El código vive ~60 segundos. El panel muestra la cuenta regresiva y lo quita cuando expira, para no dejar en pantalla un código que el teléfono contestaría como inválido.
- Si WhatsApp rechaza la solicitud (número inexistente, límite de intentos, caída de la conexión), el panel muestra el motivo en vez de un código que no sirve.
- Se pide un solo código por conexión. Con `BOT_PHONE` el pedido automático ocurre una vez, no en cada renovación del QR.
- Las credenciales provisionales del emparejamiento no se guardan en PostgreSQL: si el intento se abandona, el siguiente arranque vuelve a empezar limpio en vez de intentar iniciar sesión con un vínculo a medio hacer.

## Base de datos gratuita: Neon

El proyecto conserva PostgreSQL —necesario para transacciones, datos y sesión persistente de WhatsApp— y queda preparado para alojarlo en [Neon](https://neon.com/pricing). Es serverless y compatible con el cliente `pg`; no requiere una SDK nueva ni migrar el esquema. El plan Free oficial ofrece actualmente 1 GB de almacenamiento y 100 CU-horas mensuales por proyecto, con cómputo que escala a cero cuando queda inactivo. Revisa [los límites y precios vigentes](https://neon.com/pricing): las cuotas pueden cambiar y un bot que mantenga la base ocupada todo el tiempo puede superar la cuota gratuita.

1. Crea un proyecto PostgreSQL en Neon.
2. En el panel de Neon, copia la **pooled connection string** (el hostname suele incluir `-pooler`).
3. Configura esa URL como `DATABASE_URL` y deja `DB_SSL=true`.
4. Mantén `DATABASE_URL` como variable secreta del servicio de Render; no la publiques en GitHub.

Neon no se crea automáticamente desde este repositorio: hace falta crear el proyecto en tu cuenta y añadir su URL al entorno del despliegue.

## Despliegue en Render (plan gratuito)

1. Crea la base en Neon siguiendo los pasos anteriores.
2. En Render, crea un *Blueprint* o un *Web Service* desde este repositorio. `render.yaml` ya define build, start y health check.
3. Completa `DATABASE_URL`, `OWNER_NUMBERS` y, si quieres, `BOT_PHONE` en las variables de entorno de Render.
4. Abre la URL pública del servicio y vincula WhatsApp con QR o código.

**Limitaciones del plan gratuito de Render**

- El servicio web se duerme tras 15 minutos sin tráfico entrante; la conexión de WhatsApp se interrumpe cuando Render lo suspende.
- El disco es efímero. Por eso la sesión y los datos viven en PostgreSQL externo.

## Rutas de la interfaz web

| Ruta | Contenido |
|---|---|
| `/` | Portada: hero, tres pasos de inicio, ventajas, contadores en vivo, vista previa del menú, stack y preguntas frecuentes. |
| `/home` | Panel de control en secciones: Inicio, Conexión, Mis Bots, Comandos, Identidad, Monitor, Links y Soporte. |
| `/cmds` | Catálogo completo de comandos, con filtros por categoría, búsqueda (atajo `/`) y copia al tocar. |
| `/status` | Redirección a `/home#monitor`. |
| `/health` | JSON con el estado de la base de datos y de WhatsApp (para monitores externos). |

Endpoints que alimentan esas vistas: `/api/status`, `/api/pair`, `/api/logout`, `/api/banner`, `/api/commands`, `/api/menu`, `/api/system` (telemetría del servidor), `/api/metrics` (totales reales de la base) y `/api/logs/stream` (SSE). Todos son de lectura pública; los de escritura se limitan por IP.

## Personalización desde el panel

- Cambiar texto e imagen del banner que aparece antes del menú.
- Editar el texto decorativo que se muestra antes de cada comando (por defecto `ㅤ୨ৎㅤ.`). Esto cambia la presentación del menú, no el prefijo real `.`.
- Ver todos los comandos catalogados, buscar, activar/desactivar implementados, ocultar/restaurar entradas y crear o quitar alias.
- Revisar una vista previa del menú antes de enviarlo.

Los ajustes se guardan en PostgreSQL y se conservan al reiniciar el servicio.

## Limitaciones de WhatsApp

- Baileys es una librería no oficial. Su uso puede violar los términos de WhatsApp y provocar el bloqueo del número. Usa un número dedicado.
- El bot necesita ser administrador del grupo para expulsar, añadir o cerrar/abrir el grupo.
- `.add` depende de la privacidad del usuario. Si WhatsApp no permite añadirlo, no hay forma de forzarlo.
- WhatsApp migra identificadores de número a LID. Si un integrante aparece con LID distinto, puede requerir reregistro. Se guardan los identificadores tal como llegan.
- La inactividad solo se conoce desde que el bot ve al integrante. No existe "última conexión" para usuarios con privacidad activa.
- Los formatos de WhatsApp son solo negrita, cursiva, tachado y monoespaciado. Las tipografías Unicode son caracteres normales.

## Pruebas

```bash
npm test                                   # pruebas unitarias y validaciones
TEST_DATABASE_URL=postgres://... npm test  # además, pruebas de base de datos
```

Las pruebas de base de datos requieren una base PostgreSQL real; se ejecutan sobre tablas de prueba y vacían datos, así que usa una base dedicada.

## Estructura

```
src/
  config/        configuración y valores por defecto
  core/          conexión WhatsApp, router, aliases y ajustes de comandos
  database/      esquema, migraciones y repositorios PostgreSQL
  commands/      comandos en archivos, catálogo y menú
  events/        mensajes entrantes, entradas y salidas del grupo
  services/      reglas compartidas (desregistro, sincronización)
  messages/      diseño de mensajes de VÉRSOVA
  utils/         texto, tiempo, logs, límites de uso
  web/           servidor público, telemetría y panel web (index, home, cmds)
 tests/
```
