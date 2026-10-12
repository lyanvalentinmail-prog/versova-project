import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GroupMetadata, WAMessage, WASocket } from '@whiskeysockets/baileys';

/**
 * Bots del catálogo (carpeta `bots/`): cada pack se carga, expone sus comandos y
 * responde con su propio menú. Se ejecutan de verdad los comandos con una base de
 * datos simulada, para comprobar que Raiden WaBot y Yae Miku Bot no revientan.
 */

const GROUP = '120363000000000000@g.us';
const SENDER = '59899000111@s.whatsapp.net';
const TARGET = '59899000222@s.whatsapp.net';

vi.mock('../src/database/db.js', () => ({
  memoryMode: true,
  pool: { query: async () => ({ rows: [], rowCount: 0 }) },
  tx: async (fn: (client: unknown) => Promise<unknown>) => fn({ query: async () => ({ rows: [], rowCount: 0 }) }),
  migrate: async () => undefined,
}));

/* -------------------------------- datos ---------------------------------- */

vi.mock('../src/database/warnings.js', () => ({
  addWarning: async () => 1,
  countWarnings: async () => 0,
  listWarnings: async () => [],
  removeLastWarning: async () => true,
}));

/**
 * El modo memoria de la plataforma ya guarda los datos de los bots del catálogo
 * (tabla `bot_data` y ajustes de grupo), así que solo hay que simular las
 * funciones del núcleo que dependen de PostgreSQL.
 */
vi.mock('../src/database/repos.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/database/repos.js')>();
  return {
    ...actual,
    claimMessage: async () => true,
    isBlocked: async () => false,
    getGroup: async () => null,
    getSetting: async () => null,
    setSetting: async () => undefined,
    getUser: async () => null,
    getMember: async () => null,
    touchMember: async () => null,
  };
});

const { allPacks, packForSlug, packSummaries, renderBotMenuText } = await import('../src/bots/index.js');
const { commandsForPack, commandForPack, DEFAULT_PACK_SLUG } = await import('../src/core/bot-packs.js');
const { getActiveBotSlug, setActiveBot } = await import('../src/core/active-bot.js');
const { setGroupSetting } = await import('../src/database/store.js');
const { runGuards } = await import('../src/core/guards.js');
const { handleCommand } = await import('../src/core/router.js');
await import('../src/commands/index.js');

/* -------------------------------- contexto -------------------------------- */

const meta: GroupMetadata = {
  id: GROUP,
  subject: 'Team VÉRSOVA',
  participants: [
    { id: '59899000999@s.whatsapp.net', admin: 'superadmin' },
    { id: SENDER, admin: null },
    { id: TARGET, admin: null },
  ],
} as unknown as GroupMetadata;

interface Sent {
  chat: string;
  text: string;
  mentions?: string[];
  kind: string;
}

function makeSocket(sent: Sent[]): WASocket {
  return {
    user: { id: '59899000000@s.whatsapp.net' },
    sendMessage: async (chat: string, content: Record<string, unknown>, options?: { quoted?: WAMessage }) => {
      const kind = content.sticker ? 'sticker' : content.image ? 'image' : content.document ? 'document' : 'text';
      sent.push({
        chat,
        text: String(content.text ?? content.caption ?? ''),
        mentions: (content.mentions as string[]) ?? [],
        kind,
      });
      return { key: { id: `MSG-${sent.length}`, remoteJid: chat } } as WAMessage;
    },
    groupMetadata: async () => meta,
    profilePictureUrl: async () => 'https://example.com/foto.jpg',
    groupParticipantsUpdate: async () => undefined,
    updateMediaMessage: async () => undefined,
    ...(undefined as unknown as Record<string, never>),
  } as unknown as WASocket;
}

function message(text: string, sender = SENDER, mentions: string[] = []): WAMessage {
  return {
    key: { remoteJid: GROUP, fromMe: false, id: `IN-${Math.random().toString(36).slice(2)}`, participant: sender },
    pushName: 'Ana',
    message: {
      extendedTextMessage: { text, contextInfo: { mentionedJid: mentions } },
    },
  } as unknown as WAMessage;
}

/**
 * Cada prueba usa su propio remitente (el límite de uso es por usuario y chat)
 * pero dentro de una prueba se mantiene: los flujos con estado lo necesitan.
 */
let senderSalt = 0;
let senderBase = '';

beforeEach(() => {
  senderSalt += 1;
  senderBase = `59899${String(senderSalt).padStart(2, '0')}`;
});

function nextSender(): string {
  return `${senderBase}888@s.whatsapp.net`;
}

/** Ejecuta un comando del pack indicado con el bot activo puesto en ese pack. */
async function run(pack: string, text: string, options: { mentions?: string[]; sender?: string } = {}) {
  setActiveBot(pack);
  const sent: Sent[] = [];
  const sock = makeSocket(sent);
  await handleCommand(sock, message(text, options.sender ?? nextSender(), options.mentions ?? []));
  return sent;
}

/* --------------------------------- pruebas -------------------------------- */

describe('bots del catálogo', () => {
  it('registra los tres bots con sus comandos propios', () => {
    const packs = allPacks();
    expect(packs.map((pack) => pack.slug).sort()).toEqual(['raiden-wabot', 'versova', 'yae-miku-bot']);
    expect(packForSlug('raiden')?.slug).toBe('raiden-wabot');
    expect(packForSlug('yae-miku')?.slug).toBe('yae-miku-bot');
    expect(commandsForPack('versova').length).toBeGreaterThanOrEqual(34);
    expect(commandsForPack('raiden-wabot').length).toBeGreaterThanOrEqual(50);
    expect(commandsForPack('yae-miku-bot').length).toBeGreaterThan(34);
  });

  it('cada pack hereda los comandos del núcleo y puede reemplazarlos', () => {
    expect(commandForPack('raiden-wabot', 'reg')?.pack).toBeUndefined();
    expect(commandForPack('raiden-wabot', 'menu')?.pack).toBe('raiden-wabot');
    expect(commandForPack('raiden-wabot', 'perfil')?.pack).toBe('raiden-wabot');
    expect(commandForPack('yae-miku-bot', 'menu')?.pack).toBe('yae-miku-bot');
    // Raiden no toca el perfil del núcleo de Yae Miku.
    expect(commandForPack('yae-miku-bot', 'perfil')?.pack).toBeUndefined();
  });

  it('resume cada bot para el panel', () => {
    setActiveBot('raiden-wabot');
    const summaries = packSummaries();
    const raiden = summaries.find((pack) => pack.slug === 'raiden-wabot');
    expect(raiden?.active).toBe(true);
    expect(raiden?.ownCommands).toBeGreaterThan(20);
    expect(raiden?.totalCommands).toBeGreaterThan(raiden?.ownCommands ?? 0);
    expect(summaries.find((pack) => pack.slug === 'versova')?.active).toBe(false);
    setActiveBot(DEFAULT_PACK_SLUG);
  });

  it('genera el menú en texto de cada bot', () => {
    expect(renderBotMenuText('raiden-wabot')).toContain('RAIDEN WABOT');
    expect(renderBotMenuText('yae-miku-bot')).toContain('YAE MIKU BOT');
    expect(renderBotMenuText('raiden-wabot')).toContain('.download');
  });

  describe('Raiden WaBot', () => {
    it('responde al menú con sus comandos y su marca', async () => {
      const sent = await run('raiden-wabot', '.menu');
      expect(sent[0]?.text).toContain('ʀᴀɪᴅᴇɴ');
      expect(sent[0]?.text).toContain('.download');
      expect(sent[0]?.text).toContain('.sticker');
    });

    it('responde a ping con la versión y el estado', async () => {
      const sent = await run('raiden-wabot', '.ping');
      expect(sent[0]?.text).toContain('PONG');
      expect(sent[0]?.text).toContain('1.4.0');
    });

    it('lista las reacciones anime (más de 40)', async () => {
      const sent = await run('raiden-wabot', '.reacciones');
      expect(sent[0]?.text).toContain('.hug');
      const commands = commandsForPack('raiden-wabot').filter((command) => command.category === 'Reacciones');
      expect(commands.length).toBeGreaterThanOrEqual(40);
    });

    it('reacciona mencionando a la persona indicada', async () => {
      const sent = await run('raiden-wabot', '.hug', { mentions: [TARGET] });
      expect(sent[0]?.text).toMatch(/abrazo/i);
      expect(sent[0]?.mentions).toContain(TARGET);
    });

    it('pide el enlace cuando falta en .download', async () => {
      const sent = await run('raiden-wabot', '.download');
      expect(sent[0]?.text).toMatch(/enlace/i);
    });

    it('explica el estado del descargador con un enlace válido', async () => {
      const sent = await run('raiden-wabot', '.download https://www.youtube.com/watch?v=abc123');
      expect(sent[0]?.text).toMatch(/YouTube/i);
    });

    it('casa y divorcia a dos integrantes', async () => {
      const married = await run('raiden-wabot', '.marry', { mentions: [TARGET] });
      expect(married[0]?.text).toMatch(/casados/i);
      const again = await run('raiden-wabot', '.marry', { mentions: [TARGET] });
      expect(again[0]?.text).toMatch(/ya estás casado|ya está casada/i);
      const divorced = await run('raiden-wabot', '.divorce');
      expect(divorced[0]?.text).toMatch(/rompió con/i);
    });

    it('trabaja y suma puntos en el ranking', async () => {
      const work = await run('raiden-wabot', '.work');
      expect(work[0]?.text).toMatch(/puntos/i);
      const blocked = await run('raiden-wabot', '.work');
      expect(blocked[0]?.text).toMatch(/descansa/i);
      const top = await run('raiden-wabot', '.top');
      expect(top[0]?.text).toMatch(/ranking/i);
    });

    it('guarda el cumpleaños y avisa del formato', async () => {
      expect((await run('raiden-wabot', '.cumple 24/07'))[0]?.text).toMatch(/24\/07/);
      expect((await run('raiden-wabot', '.cumple 99/99'))[0]?.text).toMatch(/formato/i);
    });

    it('avisa cuando la IA no está configurada', async () => {
      const sent = await run('raiden-wabot', '.ai hola');
      expect(sent[0]?.text).toMatch(/AI_API_KEY/);
    });

    it('genera el logo como SVG cuando no hay conversor de imágenes', async () => {
      const sent = await run('raiden-wabot', '.logo Versova neon');
      expect(sent[0]?.kind).toBe('document');
      expect(sent[0]?.text).toMatch(/neón/i);
      const help = await run('raiden-wabot', '.logo');
      expect(help[0]?.text).toMatch(/estilos/i);
    });

    it('pide responder a una imagen en .sticker', async () => {
      const sent = await run('raiden-wabot', '.sticker');
      expect(sent[0]?.text).toMatch(/responde a una imagen/i);
    });

    it('guarda la búsqueda de .play', async () => {
      const sent = await run('raiden-wabot', '.play Raiden theme');
      expect(sent[0]?.text).toContain('youtube.com/results');
    });
  });

  describe('Yae Miku Bot', () => {
    it('responde al menú con su estilo y sus comandos propios', async () => {
      const sent = await run('yae-miku-bot', '.menu');
      expect(sent[0]?.text).toContain('ʏᴀᴇ ᴍɪᴋᴜ');
      expect(sent[0]?.text).toContain('.marry');
      expect(sent[0]?.text).toContain('.subbots');
    });

    it('guarda la propuesta y la confirma cuando la otra persona responde «sí»', async () => {
      const proposal = await run('yae-miku-bot', '.marry', { mentions: [TARGET] });
      expect(proposal[0]?.text).toMatch(/propone matrimonio/i);

      // La persona propuesta responde «sí» citando el mensaje de la propuesta.
      const sent: Sent[] = [];
      const sock = makeSocket(sent);
      const quoted = {
        key: { remoteJid: GROUP, fromMe: false, id: 'RESPUESTA', participant: TARGET },
        pushName: 'Bea',
        message: {
          extendedTextMessage: {
            text: 'sí',
            contextInfo: { stanzaId: 'MSG-1', participant: SENDER, mentionedJid: [] },
          },
        },
      } as unknown as WAMessage;
      await runGuards('yae-miku-bot', {
        sock,
        msg: quoted,
        chat: GROUP,
        isGroup: true,
        groupId: GROUP,
        sender: TARGET,
        senderName: 'Bea',
        text: 'sí',
        mentions: [],
        isAdmin: false,
        botIsAdmin: true,
        isOwner: false,
        pack: 'yae-miku-bot',
        reply: async (text, mentions) => sock.sendMessage(GROUP, { text, mentions }),
      });
      expect(sent[0]?.text).toMatch(/boda confirmada/i);

      const profile = await run('yae-miku-bot', '.profile', { sender: TARGET });
      expect(profile[0]?.text).toMatch(/días/i);
    });

    it('responde al antilink con el estado del grupo', async () => {
      const sent = await run('yae-miku-bot', '.antilink status', { sender: '59899000999@s.whatsapp.net' });
      expect(sent[0]?.text).toMatch(/antilink/i);
    });

    it('configura el antilink del grupo', async () => {
      const sent = await run('yae-miku-bot', '.config antilink delete', { sender: '59899000999@s.whatsapp.net' });
      expect(sent[0]?.text).toMatch(/antilink actualizado/i);
    });

    it('rechaza la configuración de quien no es administrador', async () => {
      const sent = await run('yae-miku-bot', '.config mute on');
      expect(sent[0]?.text).toMatch(/administradores/i);
    });

    it('lista los sub-bots del grupo', async () => {
      const sent = await run('yae-miku-bot', '.subbots');
      expect(sent[0]?.text).toMatch(/sub-bots del grupo/i);
    });

    it('despide con .menu <comando> explicando el uso', async () => {
      const sent = await run('yae-miku-bot', '.menu marry');
      expect(sent[0]?.text).toMatch(/\.marry/i);
      const missing = await run('yae-miku-bot', '.menu inexistente');
      expect(missing[0]?.text).toMatch(/no existe/i);
    });
  });

  describe('guardias compartidas', () => {
    it('borra los enlaces cuando el antilink está activo', async () => {
      setActiveBot('yae-miku-bot');
      await setGroupSetting(GROUP, 'antilink', { enabled: true, action: 'warn' });
      const deleted: string[] = [];
      const sent: Sent[] = [];
      const sock = makeSocket(sent);
      const original = sock.sendMessage;
      (sock as unknown as { sendMessage: WASocket['sendMessage'] }).sendMessage = (async (chat, content, options) => {
        if (content && typeof content === 'object' && 'delete' in content) {
          deleted.push(chat);
          return undefined;
        }
        return original(chat, content as Record<string, unknown>, options);
      }) as WASocket['sendMessage'];

      await runGuards('yae-miku-bot', {
        sock,
        msg: message('mira esto https://ejemplo.com/oferta'),
        chat: GROUP,
        isGroup: true,
        groupId: GROUP,
        sender: SENDER,
        senderName: 'Ana',
        text: 'mira esto https://ejemplo.com/oferta',
        mentions: [],
        isAdmin: false,
        botIsAdmin: true,
        isOwner: false,
        pack: 'yae-miku-bot',
        reply: async (text, mentions) => sock.sendMessage(GROUP, { text, mentions }),
      });

      expect(deleted).toEqual([GROUP]);
      expect(sent[0]?.text).toMatch(/aviso 1\/3/i);

      await setGroupSetting(GROUP, 'antilink', { enabled: false, action: 'warn' });
      expect(runGuards).toBeTypeOf('function');
    });

    it('solo el bot activo ejecuta sus guardias', async () => {
      const calls: string[] = [];
      const sock = { sendMessage: async () => void calls.push('send') } as unknown as WASocket;
      await runGuards('versova', {
        sock,
        msg: message('https://ejemplo.com'),
        chat: GROUP,
        isGroup: true,
        groupId: GROUP,
        sender: SENDER,
        senderName: 'Ana',
        text: 'https://ejemplo.com',
        mentions: [],
        isAdmin: false,
        botIsAdmin: true,
        isOwner: false,
        pack: 'versova',
        reply: async () => undefined,
      });
      expect(calls).toEqual([]);
    });
  });

  it('vuelve al bot base al terminar', () => {
    setActiveBot(DEFAULT_PACK_SLUG);
    expect(getActiveBotSlug()).toBe('versova');
  });
});
