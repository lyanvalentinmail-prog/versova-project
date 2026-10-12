# VÉRSOVA · bot de WhatsApp para teams de rol

Bot de WhatsApp para administrar teams de rol. Prefijo `.` · Versión 1.0 · Idioma español.

## Estado actual

**Implementado**

- Conexión con WhatsApp (QR y código de emparejamiento), reconexión automática y sesión guardada en PostgreSQL.
- Consola web: estado, QR, código de emparejamiento, cerrar sesión, banner (texto e imagen) y logs en vivo.
- Registro: `.reg`, `.unreg` (con confirmación), `.editar`, `.ficha`.
- Roles: `.rol`, `.roles`, `.mirol`, `.cambiarol`, `.reservar` (24 h, con liberación automática), `.liberar` (con confirmación), `.resetrol`, `.acceptrol` y `.denyrol` (respondiendo a la solicitud).
- `.menu` generado desde los comandos reales, con banner configurable.
- Separación de datos por grupo, deduplicación de mensajes, límite de uso por usuario, auditoría de acciones administrativas y sincronización al salir del grupo.
- Actividad y AFK: registro de última actividad, `.afk` y aviso cuando mencionan a alguien AFK (la limpieza automática al escribir está implementada).

**Pendiente (próxima entrega)**

`.team`, `.miembros`, `.afk` (comando), `.inactivos`, `.perfil`, `.pareja`, `.aceptar`, `.rechazar`, `.terminar`, `.ship`, `.reglas`, `.admins`, `.add`, `.expulsar`, `.ban`, `.unban` (con expulsión al volver a entrar), `.warn`, `.unwarn` (expulsión automática a las 3), `.anuncio`, `.close`, `.open`.

Solo aparecen en el menú los comandos que ya existen.

## Requisitos

- Node.js 22 o superior.
- PostgreSQL. En Render gratuito usa una base externa (por ejemplo, Neon).
- Un número de WhatsApp dedicado para el bot.

## Configuración

```bash
cp .env.example .env   # y completa los valores
npm ci
npm run build
npm start
```

Consola: `http://localhost:3000` (entra con `CONSOLE_KEY`).

Variables importantes:

| Variable | Uso |
|---|---|
| `DATABASE_URL` | Cadena de conexión PostgreSQL. |
| `DB_SSL` | `true` para bases con SSL (Neon). `false` solo en local. |
| `CONSOLE_KEY` | Clave de la consola web (mínimo 12 caracteres). |
| `OWNER_NUMBERS` | Números del propietario del bot, con código de país, separados por coma. |
| `BOT_PHONE` | Opcional: número del bot para emparejar por código al arrancar. |

## Despliegue en Render (plan gratuito)

1. Crea una base PostgreSQL gratuita (Neon) y copia la cadena de conexión.
2. En Render, crea un *Blueprint* o un *Web Service* desde este repositorio. `render.yaml` ya define build, start y health check.
3. Completa `DATABASE_URL`, `CONSOLE_KEY`, `OWNER_NUMBERS` y, si quieres, `BOT_PHONE`.
4. Abre la URL del servicio, entra con la clave y vincula el bot con QR o con código.

**Limitaciones del plan gratuito de Render**

- El servicio se duerme tras 15 minutos sin tráfico, lo que corta la conexión con WhatsApp. Un monitor externo que consulte `/health` cada pocos minutos lo mantiene activo.
- El disco es efímero. Por eso la sesión y los datos están en PostgreSQL externo.

## Limitaciones de WhatsApp

- Baileys es una librería no oficial. Su uso puede violar los términos de WhatsApp y provocar el bloqueo del número. Usa un número dedicado.
- El bot necesita ser administrador del grupo para expulsar, añadir o cerrar/abrir el grupo.
- `.add` depende de la privacidad del usuario. Si WhatsApp no permite añadirlo, no hay forma de forzarlo.
- WhatsApp migra identificadores de número a LID. Si un integrante aparece con LID distinto, puede requerir reregistro. Se guardan los identificadores tal como llegan.
- La inactividad solo se conoce desde que el bot ve al integrante. No existe "última conexión" para usuarios con privacidad activa.
- La sincronización al salir requiere que el bot esté conectado. Si estaba apagado, se detectará comparando miembros al reconectar (pendiente).
- Los formatos de WhatsApp son solo negrita, cursiva, tachado y monoespaciado. Las tipografías Unicode son caracteres normales.

## Pruebas

```bash
npm test                                   # validaciones (sin base de datos)
TEST_DATABASE_URL=postgres://... npm test  # además, pruebas de base de datos
```

Las pruebas de base de datos requieren una base PostgreSQL real; se ejecutan sobre tablas de prueba y vacían datos, así que usa una base dedicada.

## Estructura

```
src/
  config/        configuración y valores por defecto
  core/          conexión WhatsApp, router de comandos, permisos, sesión en PostgreSQL
  database/      esquema, migraciones y repositorios
  commands/      registro/, roles/, general/ (menú)
  events/        mensajes entrantes, entradas y salidas del grupo
  services/      reglas compartidas (desregistro, sincronización)
  messages/      diseño de mensajes de VÉRSOVA
  utils/         texto, tiempo, logs, límites de uso
  web/           servidor de la consola y su interfaz
tests/
```
