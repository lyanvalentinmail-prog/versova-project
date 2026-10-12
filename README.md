# VÉRSOVA · bot de WhatsApp para teams de rol

Bot de WhatsApp para administrar teams de rol. Prefijo `.` · Versión 1.0 · Idioma español.

## Estado actual

**Implementado**

- Conexión con WhatsApp (QR y código de emparejamiento), reconexión automática y sesión guardada en PostgreSQL.
- Panel web público, sin clave: estado del bot, QR, emparejamiento, cerrar sesión, banner, lista de comandos, alias, activación/desactivación, vista previa del menú y logs en vivo.
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

## Aviso importante: el panel es público

La consola **no pide contraseña ni autentica a los visitantes**. Cualquiera que tenga la URL puede cambiar el banner y el menú, desactivar comandos, consultar la actividad y usar los controles de WhatsApp (incluidos emparejamiento y cierre de sesión). El QR y el código de emparejamiento también se muestran a los visitantes mientras estén activos. No publiques la URL si no quieres conceder ese acceso.

Los cambios del panel se limitan por IP para reducir el abuso accidental, pero el límite no es un mecanismo de autenticación.

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

Panel: `http://localhost:3000`. No hay inicio de sesión.

Variables:

| Variable | Uso |
|---|---|
| `DATABASE_URL` | URL PostgreSQL pooled de Neon, con `sslmode=require`. También acepta PostgreSQL local. |
| `DB_SSL` | `true` para Neon y otras bases con SSL; `false` solo en local. |
| `OWNER_NUMBERS` | Números del propietario, con código de país, separados por coma. |
| `BOT_PHONE` | Opcional: número del bot para pedir un código de emparejamiento al arrancar. |
| `PORT` | Puerto HTTP (Render asigna su propio valor). |

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
  web/           servidor público y panel claro/oscuro
 tests/
```
