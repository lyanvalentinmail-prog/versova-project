export const SCHEMA_VERSION = 3;

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
`;
