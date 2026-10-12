export const SCHEMA_VERSION = 5;

export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS groups (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL DEFAULT '',
  admins        JSONB NOT NULL DEFAULT '[]',
  settings      JSONB NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Todas las personas vistas en el grupo (registradas o no): actividad y AFK.
CREATE TABLE IF NOT EXISTS members (
  group_id          TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  wa_id             TEXT NOT NULL,
  push_name         TEXT NOT NULL DEFAULT '',
  last_activity_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  afk_reason        TEXT,
  afk_since         TIMESTAMPTZ,
  PRIMARY KEY (group_id, wa_id)
);

-- Integrantes registrados.
CREATE TABLE IF NOT EXISTS users (
  group_id       TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  wa_id          TEXT NOT NULL,
  name           TEXT NOT NULL,
  age            INTEGER NOT NULL,
  character_id   INTEGER,
  partner_id     TEXT,
  partner_since  TIMESTAMPTZ,
  registered_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (group_id, wa_id)
);

CREATE TABLE IF NOT EXISTS characters (
  id             SERIAL PRIMARY KEY,
  group_id       TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  name           TEXT NOT NULL,
  name_key       TEXT NOT NULL,
  status         TEXT NOT NULL DEFAULT 'free' CHECK (status IN ('free','occupied')),
  owner_id       TEXT,
  reserved_by    TEXT,
  reserved_until TIMESTAMPTZ,
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (group_id, name_key)
);
CREATE UNIQUE INDEX IF NOT EXISTS one_owner_per_character
  ON characters (group_id, owner_id) WHERE owner_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS requests (
  id              SERIAL PRIMARY KEY,
  group_id        TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id         TEXT NOT NULL,
  type            TEXT NOT NULL CHECK (type IN ('rol','cambio','pareja')),
  character_id    INTEGER,
  target_id       TEXT,
  status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','cancelled')),
  wa_message_id   TEXT,
  resolved_by     TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at     TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS requests_msg ON requests (group_id, wa_message_id);

CREATE TABLE IF NOT EXISTS group_blocks (
  group_id    TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  wa_id       TEXT NOT NULL,
  reason      TEXT,
  blocked_by  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (group_id, wa_id)
);

CREATE TABLE IF NOT EXISTS warnings (
  id          SERIAL PRIMARY KEY,
  group_id    TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  wa_id       TEXT NOT NULL,
  reason      TEXT NOT NULL,
  admin_id    TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS audit_log (
  id          SERIAL PRIMARY KEY,
  group_id    TEXT,
  actor       TEXT NOT NULL,
  action      TEXT NOT NULL,
  target      TEXT,
  details     JSONB NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Evita ejecutar dos veces el mismo mensaje (WhatsApp puede reenviarlo).
CREATE TABLE IF NOT EXISTS processed_messages (
  message_id    TEXT PRIMARY KEY,
  processed_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Sesión de Baileys guardada en la base (sobrevive a reinicios en Render).
CREATE TABLE IF NOT EXISTS auth_state (
  key    TEXT PRIMARY KEY,
  value  JSONB NOT NULL
);

-- Ajustes globales: banner, etc.
CREATE TABLE IF NOT EXISTS settings (
  key    TEXT PRIMARY KEY,
  value  JSONB NOT NULL
);

-- ============================= CUENTAS DE LA WEB =============================

-- Cuentas de la plataforma (inicio de sesión con Google o email + clave).
CREATE TABLE IF NOT EXISTS web_users (
  id             SERIAL PRIMARY KEY,
  email          TEXT NOT NULL UNIQUE,
  name           TEXT NOT NULL DEFAULT '',
  picture        TEXT,
  google_sub     TEXT UNIQUE,
  password_hash  TEXT,
  plan           TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free','premium','vip')),
  extra_space_gb INTEGER NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Sesiones de la web (cookie httpOnly).
CREATE TABLE IF NOT EXISTS web_sessions (
  token       TEXT PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES web_users(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at  TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS web_sessions_user ON web_sessions (user_id);

-- Tokens de la tienda (premium / vip) que se canjean al crear un sub-bot.
CREATE TABLE IF NOT EXISTS store_tokens (
  code            TEXT PRIMARY KEY,
  type            TEXT NOT NULL CHECK (type IN ('premium','vip')),
  space_gb        INTEGER NOT NULL,
  status          TEXT NOT NULL DEFAULT 'unused' CHECK (status IN ('unused','redeemed')),
  owner_id        INTEGER REFERENCES web_users(id) ON DELETE SET NULL,
  redeemed_by_bot INTEGER,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  redeemed_at     TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS store_tokens_owner ON store_tokens (owner_id);

-- Sub-bots creados por cada usuario (free / premium / vip).
CREATE TABLE IF NOT EXISTS subbots (
  id           SERIAL PRIMARY KEY,
  user_id      INTEGER NOT NULL REFERENCES web_users(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  tier         TEXT NOT NULL DEFAULT 'free' CHECK (tier IN ('free','premium','vip')),
  token_code   TEXT,
  phone        TEXT NOT NULL DEFAULT '',
  description  TEXT NOT NULL DEFAULT '',
  status       TEXT NOT NULL DEFAULT 'offline' CHECK (status IN ('online','offline','paused')),
  extra_gb     INTEGER NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS subbots_user ON subbots (user_id);

-- Historial de compras de la tienda (pago simulado en modo demo).
CREATE TABLE IF NOT EXISTS purchases (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES web_users(id) ON DELETE CASCADE,
  item_id    TEXT NOT NULL,
  item_name  TEXT NOT NULL,
  quantity   INTEGER NOT NULL DEFAULT 1,
  price_usd  NUMERIC(10,2) NOT NULL DEFAULT 0,
  details    JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS purchases_user ON purchases (user_id);

-- v3: identidad personalizable por sub-bot
ALTER TABLE subbots ADD COLUMN IF NOT EXISTS bot_type       TEXT NOT NULL DEFAULT 'versova';
ALTER TABLE subbots ADD COLUMN IF NOT EXISTS display_name  TEXT NOT NULL DEFAULT '';
ALTER TABLE subbots ADD COLUMN IF NOT EXISTS bot_prefix    TEXT NOT NULL DEFAULT '.';
ALTER TABLE subbots ADD COLUMN IF NOT EXISTS banner_text   TEXT NOT NULL DEFAULT '';

-- Reglas y anuncios configurables por grupo.
ALTER TABLE groups ADD COLUMN IF NOT EXISTS rules TEXT NOT NULL DEFAULT '';

-- ===================== v4: catálogo y opciones del bot =====================

-- Perfil público de la cuenta.
ALTER TABLE web_users ADD COLUMN IF NOT EXISTS handle       TEXT;
ALTER TABLE web_users ADD COLUMN IF NOT EXISTS avatar_url   TEXT;
ALTER TABLE web_users ADD COLUMN IF NOT EXISTS theme        TEXT NOT NULL DEFAULT 'dark';
ALTER TABLE web_users ADD COLUMN IF NOT EXISTS referral     TEXT;

-- Opciones completas de cada bot (lo que se edita en «Opciones del bot»).
ALTER TABLE subbots ADD COLUMN IF NOT EXISTS short_name     TEXT NOT NULL DEFAULT '';
ALTER TABLE subbots ADD COLUMN IF NOT EXISTS long_name      TEXT NOT NULL DEFAULT '';
ALTER TABLE subbots ADD COLUMN IF NOT EXISTS currency       TEXT NOT NULL DEFAULT '';
ALTER TABLE subbots ADD COLUMN IF NOT EXISTS owner_number   TEXT NOT NULL DEFAULT '';
ALTER TABLE subbots ADD COLUMN IF NOT EXISTS owner_hidden   BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE subbots ADD COLUMN IF NOT EXISTS bot_link       TEXT NOT NULL DEFAULT '';
ALTER TABLE subbots ADD COLUMN IF NOT EXISTS channel_url    TEXT NOT NULL DEFAULT '';
ALTER TABLE subbots ADD COLUMN IF NOT EXISTS prefixes       JSONB NOT NULL DEFAULT '["."]';
ALTER TABLE subbots ADD COLUMN IF NOT EXISTS banner_url     TEXT NOT NULL DEFAULT '';
ALTER TABLE subbots ADD COLUMN IF NOT EXISTS username       TEXT NOT NULL DEFAULT '';
ALTER TABLE subbots ADD COLUMN IF NOT EXISTS status_info    TEXT NOT NULL DEFAULT 'online';
ALTER TABLE subbots ADD COLUMN IF NOT EXISTS instance_type  TEXT NOT NULL DEFAULT 'subbot';
ALTER TABLE subbots ADD COLUMN IF NOT EXISTS server_id      TEXT NOT NULL DEFAULT 'vrsov-01';
ALTER TABLE subbots ADD COLUMN IF NOT EXISTS server_name    TEXT NOT NULL DEFAULT 'Vrsov Srv Asuna';
ALTER TABLE subbots ADD COLUMN IF NOT EXISTS pairing_code   TEXT;
ALTER TABLE subbots ADD COLUMN IF NOT EXISTS pairing_expires_at TIMESTAMPTZ;
ALTER TABLE subbots ADD COLUMN IF NOT EXISTS linked_at      TIMESTAMPTZ;
ALTER TABLE subbots ADD COLUMN IF NOT EXISTS synced_at      TIMESTAMPTZ;
ALTER TABLE subbots ADD COLUMN IF NOT EXISTS uptime_seconds INTEGER NOT NULL DEFAULT 0;
ALTER TABLE subbots ADD COLUMN IF NOT EXISTS avatar_url     TEXT NOT NULL DEFAULT '';
ALTER TABLE subbots ADD COLUMN IF NOT EXISTS catalog_slug   TEXT NOT NULL DEFAULT 'versova';

-- Catálogo de bots de la plataforma (gratis, con monedas o con USD).
CREATE TABLE IF NOT EXISTS bot_catalog (
  slug         TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  emoji        TEXT NOT NULL DEFAULT '🤖',
  tagline      TEXT NOT NULL DEFAULT '',
  description  TEXT NOT NULL DEFAULT '',
  category     TEXT NOT NULL DEFAULT 'Utilidades',
  pricing      TEXT NOT NULL DEFAULT 'free' CHECK (pricing IN ('free','coins','usd')),
  price_coins  INTEGER NOT NULL DEFAULT 0,
  price_usd    NUMERIC(10,2) NOT NULL DEFAULT 0,
  badge        TEXT,
  accent       TEXT NOT NULL DEFAULT '#8b5cf6',
  features     JSONB NOT NULL DEFAULT '[]',
  commands     JSONB NOT NULL DEFAULT '[]',
  popularity   INTEGER NOT NULL DEFAULT 0,
  featured     BOOLEAN NOT NULL DEFAULT false,
  active       BOOLEAN NOT NULL DEFAULT true,
  sort         INTEGER NOT NULL DEFAULT 100,
  link         TEXT NOT NULL DEFAULT '',
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Bots del catálogo que cada cuenta ya activó.
CREATE TABLE IF NOT EXISTS catalog_uses (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES web_users(id) ON DELETE CASCADE,
  bot_slug   TEXT NOT NULL REFERENCES bot_catalog(slug) ON DELETE CASCADE,
  subbot_id  INTEGER REFERENCES subbots(id) ON DELETE SET NULL,
  paid_coins INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, bot_slug)
);
CREATE INDEX IF NOT EXISTS catalog_uses_user ON catalog_uses (user_id);

-- Grupos vinculados a cada bot.
CREATE TABLE IF NOT EXISTS subbot_groups (
  id         SERIAL PRIMARY KEY,
  subbot_id  INTEGER NOT NULL REFERENCES subbots(id) ON DELETE CASCADE,
  group_jid  TEXT NOT NULL,
  name       TEXT NOT NULL DEFAULT '',
  members    INTEGER NOT NULL DEFAULT 0,
  active     BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (subbot_id, group_jid)
);
CREATE INDEX IF NOT EXISTS subbot_groups_bot ON subbot_groups (subbot_id);

-- Servidores de instancias (paso 2 del asistente y monitor).
CREATE TABLE IF NOT EXISTS platform_servers (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  provider   TEXT NOT NULL DEFAULT 'Versova Cloud',
  region     TEXT NOT NULL DEFAULT '',
  capacity   INTEGER NOT NULL DEFAULT 60,
  used       INTEGER NOT NULL DEFAULT 0,
  cpu        INTEGER NOT NULL DEFAULT 0,
  ram        INTEGER NOT NULL DEFAULT 0,
  disk       INTEGER NOT NULL DEFAULT 0,
  status     TEXT NOT NULL DEFAULT 'online' CHECK (status IN ('online','full','maintenance')),
  ip         TEXT NOT NULL DEFAULT ''
);

-- Reportes y sugerencias enviadas desde la web.
CREATE TABLE IF NOT EXISTS reports (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER REFERENCES web_users(id) ON DELETE SET NULL,
  kind       TEXT NOT NULL CHECK (kind IN ('report','suggestion')),
  username   TEXT NOT NULL DEFAULT '',
  whatsapp   TEXT NOT NULL DEFAULT '',
  text       TEXT NOT NULL,
  status     TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','reviewing','done')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS reports_user ON reports (user_id, created_at DESC);

-- ===================== v5: sin economía; repos GitHub en el catálogo =====================

-- La economía (V-Coins, misiones, banco por grupo) se eliminó por completo:
-- se borran sus tablas y la columna de saldo para que no queden restos en bases existentes.
ALTER TABLE bot_catalog ADD COLUMN IF NOT EXISTS link TEXT NOT NULL DEFAULT '';
DROP TABLE IF EXISTS group_bank;
DROP TABLE IF EXISTS coin_ledger;
DROP TABLE IF EXISTS coin_items;
DROP TABLE IF EXISTS mission_claims;
ALTER TABLE web_users DROP COLUMN IF EXISTS coins;
`;
