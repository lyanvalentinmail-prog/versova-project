import type { BaileysEventMap, WASocket } from '@whiskeysockets/baileys';
import { getGroupMeta, invalidateGroupMeta } from '../core/permissions.js';
import { onMemberLeft } from '../services/registry.js';
import { audit } from '../database/repos.js';
import { normalizeJid } from '../utils/text.js';
import { mention } from '../messages/design.js';
import * as F from '../messages/design.js';
import { logger } from '../utils/logger.js';

export async function onParticipantsUpdate(
  sock: WASocket,
  event: BaileysEventMap['group-participants.update'],
): Promise<void> {
  const groupId = event.id;
  const me = sock.user?.id ? normalizeJid(sock.user.id) : null;
  const people = event.participants
    .map((p) => (typeof p === 'string' ? p : p.id))
    .map(normalizeJid)
    .filter((jid) => jid !== me);

  switch (event.action) {
    case 'add':
      for (const jid of people) {
        await sock
          .sendMessage(groupId, { text: F.bienvenida({ user: mention(jid) }), mentions: [jid] })
          .catch(() => undefined);
      }
      break;

    case 'remove':
      for (const jid of people) {
        const hadRecord = await onMemberLeft(groupId, jid);
        await audit(groupId, 'sistema', 'member_left', jid, { hadRecord }).catch(() => undefined);
        await sock
          .sendMessage(groupId, { text: F.despedida({ user: mention(jid) }), mentions: [jid] })
          .catch(() => undefined);
      }
      break;

    case 'promote':
    case 'demote':
      invalidateGroupMeta(groupId);
      await getGroupMeta(sock, groupId, true).catch((err) =>
        logger.warn('group', `No se pudieron actualizar admins: ${(err as Error).message}`),
      );
      break;
  }
}
