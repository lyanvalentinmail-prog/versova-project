import { BufferJSON, initAuthCreds, proto, type AuthenticationCreds, type AuthenticationState, type SignalDataTypeMap } from '@whiskeysockets/baileys';
import { pool } from '../database/db.js';

/** Estado de autenticación de Baileys guardado en PostgreSQL (no en archivos locales). */
export async function usePgAuthState(): Promise<{ state: AuthenticationState; saveCreds: () => Promise<void> }> {
  const write = (value: unknown, key: string) =>
    pool.query(
      `INSERT INTO auth_state (key, value) VALUES ($1, $2)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
      [key, JSON.stringify(value, BufferJSON.replacer)],
    );
  const read = async (key: string) => {
    const r = await pool.query<{ value: unknown }>('SELECT value FROM auth_state WHERE key = $1', [key]);
    if (!r.rows[0]) return null;
    return JSON.parse(JSON.stringify(r.rows[0].value), BufferJSON.reviver);
  };
  const remove = (key: string) => pool.query('DELETE FROM auth_state WHERE key = $1', [key]);

  const creds: AuthenticationCreds = (await read('creds')) ?? initAuthCreds();

  return {
    state: {
      creds,
      keys: {
        get: async (type, ids) => {
          const out: { [id: string]: SignalDataTypeMap[typeof type] } = {};
          await Promise.all(
            ids.map(async (id) => {
              let value = await read(`${type}-${id}`);
              if (type === 'app-state-sync-key' && value) {
                value = proto.Message.AppStateSyncKeyData.fromObject(value);
              }
              out[id] = value as SignalDataTypeMap[typeof type];
            }),
          );
          return out;
        },
        set: async (data) => {
          const tasks: Promise<unknown>[] = [];
          for (const category in data) {
            const items = data[category as keyof SignalDataTypeMap] ?? {};
            for (const id in items) {
              const value = items[id];
              const key = `${category}-${id}`;
              tasks.push(value ? write(value, key) : remove(key));
            }
          }
          await Promise.all(tasks);
        },
      },
    },
    saveCreds: async () => {
      await write(creds, 'creds');
    },
  };
}

/** Borra la sesión guardada (al cerrar sesión desde el teléfono o al pedir una nueva vinculación). */
export async function clearPgAuthState(): Promise<void> {
  await pool.query('DELETE FROM auth_state');
}
