import { describe, expect, it, vi } from 'vitest';
import type { GroupMetadata, WASocket } from '@whiskeysockets/baileys';

/**
 * Prueba de humo de TODOS los comandos: se ejecuta cada comando registrado con un
 * contexto realista y una base de datos simulada. Sirve para comprobar que ninguno
 * revienta en tiempo de ejecución (plantillas, imports o datos inesperados).
 */

const GROUP = '120363000000000000@g.us';
const TARGET = '59899000222@s.whatsapp.net';

/* --------------------------- base de datos falsa -------------------------- */

const now = new Date();
const person = (extra: Record<string, unknown> = {}) => ({
  group_id: GROUP,
  wa_id: TARGET,
  name: 'Ana',
  age: 22,
  push_name: 'Ana',
  character_id: null,
  character: 'Ana',
  partner_id: null,
  registered_at: now,
  last_activity_at: now,
  afk_reason: null,
  afk_since: null,
  coins: 500,
  ...extra,
});

const pendingRequest = {
  id: 1,
  group_id: GROUP,
  user_id: TARGET,
  type: 'pareja',
  character_id: null,
  target_id: '59899000333@s.whatsapp.net',
  status: 'pending',
  wa_message_id: 'MSG-QUOTE',
  created_at: now,
};

vi.mock('../src/database/repos.js', () => {
  const db: Record<string, unknown> = {
    claimMessage: async () => true,
    isBlocked: async () => false,
    blockUser: async () => undefined,
    unblockUser: async () => true,
    audit: async () => undefined,
    touchMember: async () => person(),
    getMember: async () => person(),
    listMembers: async () => [person()],
    setAfk: async () => undefined,
    clearAfk: async () => undefined,
    getGroup: async () => ({ id: GROUP, name: 'Team', admins: [], settings: {} }),
    ensureGroup: async () => ({ id: GROUP, name: 'Team', admins: [], settings: {} }),
    saveGroupAdmins: async () => undefined,
    listGroupIds: async () => [GROUP],
    getGroupRules: async () => 'Sé buena persona.',
    setGroupRules: async () => undefined,
    listUsers: async () => [person()],
    getUser: async () => person(),
    insertUser: async () => person(),
    updateUserProfile: async () => person(),
    deleteUser: async () => undefined,
    listCharactersOccupied: async () => [{ id: 1, name: 'Ana' }],
    getCharacterById: async () => ({ id: 1, name: 'Ana', owner_id: TARGET }),
    ensureCharacter: async () => ({ id: 1, name: 'Ana', group_id: GROUP, owner_id: null }),
    lockCharacter: async () => ({ id: 1, name: 'Ana' }),
    setCharacterOwner: async () => undefined,
    setCharacterReservation: async () => undefined,
    setUserCharacter: async () => undefined,
    getActiveReservationOf: async () => null,
    hasPendingRequest: async () => false,
    createRequest: async () => 1,
    cancelPendingRequests: async () => 0,
    resolveRequest: async () => true,
    setRequestMessage: async () => undefined,
    findPendingByMessage: async () => pendingRequest,
    findLatestPendingByTarget: async () => pendingRequest,
    findLatestPendingByUser: async () => pendingRequest,
    updatePartner: async () => undefined,
    getSetting: async () => null,
    setSetting: async () => undefined,
    getPlatformMetrics: async () => ({
      groups: 0, members: 0, activeMembers: 0, users: 0, characters: 0,
      charactersOccupied: 0, pendingRequests: 0, warnings: 0, actions: 0, lastActivityAt: null,
    }),
  };
  return db;
});

vi.mock('../src/database/warnings.js', () => ({
  addWarning: async () => 1,
  countWarnings: async () => 1,
  listWarnings: async () => [],
  removeLastWarning: async () => true,
}));

vi.mock('../src/database/db.js', () => ({
  memoryMode: true,
  pool: { query: async () => ({ rows: [], rowCount: 0 }) },
  tx: async (fn: (client: unknown) => Promise<unknown>) => fn({ query: async () => ({ rows: [], rowCount: 0 }) }),
  migrate: async () => undefined,
}));

const { allCommands, handleCommand } = await import('../src/core/router.js');
await import('../src/commands/index.js');

/* -------------------------------- contexto -------------------------------- */

const meta = {
  id: GROUP,
  subject: 'Team VÉRSOVA',
  participants: [
    { id: '59899000111@s.whatsapp.net', admin: 'superadmin' },
    { id: TARGET, admin: null },
  ],
} as unknown as GroupMetadata;

interface Sent {
  chat: string;
  text: string;
  mentions: string[];
}

const sent: Sent[] = [];

function makeSocket(): WASocket {
  return {
    sendMessage: async (chat: string, content: { text?: string; mentions?: string[] }) => {
      sent.push({ chat, text: content?.text ?? '', mentions: content?.mentions ?? [] });
      return { key: { id: `SALIDA-${sent.length}` } } as never;
    },
    groupMetadata: async () => meta,
    groupParticipantsUpdate: async () => [{ status: '200' }],
    groupSettingUpdate: async () => undefined,
    readMessages: async () => undefined,
    updateProfilePicture: async () => undefined,
  } as unknown as WASocket;
}

let counter = 0;

function makeMessage(text: string, sender: string) {
  counter += 1;
  return {
    key: { id: `ENTRADA-${counter}`, remoteJid: GROUP, participant: sender, fromMe: false },
    pushName: 'Ana',
    message: {
      extendedTextMessage: {
        text,
        contextInfo: { stanzaId: 'MSG-QUOTE', mentionedJid: [TARGET] },
      },
    },
  } as never;
}

/** Argumentos por comando: los que necesitan menciones o textos concretos. */
const ARGS: Record<string, string> = {
  reg: 'Ana.22',
  editar: 'Ana.23',
  reservar: 'Ana',
  rol: 'Ana',
  'mi-rol': '',
  ficha: '@Ana',
  roles: '',
  team: '',
  miembros: '',
  inactivos: '3',
  afk: 'Estudiando',
  'no-afk': '',
  perfil: '@Ana',
  pareja: '@Ana',
  aceptar: '@Ana',
  rechazar: '@Ana',
  ship: '@Ana',
  reglas: 'Sé buena persona con todos.',
  reglas_set: 'set Sé buena persona con todos.',
  admins: '',
  warn: '@Ana rompió una regla',
  unwarn: '@Ana',
  expulsar: '@Ana motivos varios',
  add: '@Ana',
  ban: '@Ana motivo',
  unban: '@Ana',
  anuncio: 'Reunión del team hoy a las 21 h.',
  close: '',
  open: '',
};

/**
 * Prueba de humo: ejecuta un comando y comprueba que no cayó en el error genérico
 * (que es lo que responde el router cuando `run` lanza una excepción).
 */
async function runCommand(name: string, argText = ''): Promise<Sent[]> {
  sent.length = 0;
  const sock = makeSocket();
  // Un remitente distinto por comando: el límite de velocidad es por usuario y chat.
  const sender = `5989900${String(1000 + counter).slice(0, 4)}@s.whatsapp.net`;
  const text = `.${name}${argText ? ` ${argText}` : ''}`;
  await handleCommand(sock, makeMessage(text, sender));
  return sent;
}

describe('todos los comandos del catálogo', () => {
  it('registra cada comando del menú', async () => {
    const { getCommandInventory } = await import('../src/commands/catalog.js');
    const inventory = getCommandInventory();
    const pendientes = inventory.filter((item) => !item.implemented).map((item) => item.name);
    expect(pendientes).toEqual([]);
    expect(inventory.filter((item) => item.implemented).length).toBeGreaterThanOrEqual(34);
  });

  it('ejecuta cada comando sin reventar y responde algo', async () => {
    const commands = allCommands();
    expect(commands.length).toBeGreaterThanOrEqual(34);

    const fallos: string[] = [];
    for (const command of commands) {
      // `reglas set` se prueba aparte: necesita un texto largo como argumento.
      const argText = command.name === 'reglas' ? 'set Sé buena persona con todos.' : (ARGS[command.name] ?? '');
      const salidas = await runCommand(command.name, argText);
      const generico = salidas.find((salida) => salida.text.includes('Algo salió mal al procesar ese comando'));
      if (generico) fallos.push(`.${command.name} → excepción interna`);
      else if (!salidas.length) fallos.push(`.${command.name} → sin respuesta`);
    }

    expect(fallos).toEqual([]);
  });

  it('responde al .menu con el catálogo completo', async () => {
    const salidas = await runCommand('menu');
    expect(salidas[0]?.text).toContain('𝓜𝓮𝓷𝓾 𝓭𝓮 𝓬𝓸𝓶𝓪𝓷𝓭𝓸𝓼');
    expect(salidas[0]?.text).toContain('.open');
  });
});
