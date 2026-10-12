import type { GroupMetadata, WASocket } from '@whiskeysockets/baileys';
import { config } from '../config/index.js';
import { ensureGroup, saveGroupAdmins } from '../database/repos.js';
import { userPart } from '../utils/text.js';

const cache = new Map<string, { at: number; meta: GroupMetadata }>();
const TTL_MS = 30_000;

/** Metadatos del grupo con caché corta. Actualiza nombre y admins en la base. */
export async function getGroupMeta(sock: WASocket, groupId: string, force = false): Promise<GroupMetadata> {
  const hit = cache.get(groupId);
  if (hit && !force && Date.now() - hit.at < TTL_MS) return hit.meta;
  const meta = await sock.groupMetadata(groupId);
  cache.set(groupId, { at: Date.now(), meta });
  await ensureGroup(groupId, meta.subject ?? '');
  await saveGroupAdmins(groupId, adminIds(meta));
  return meta;
}

export function invalidateGroupMeta(groupId: string): void {
  cache.delete(groupId);
}

type Participant = GroupMetadata['participants'][number] & { phoneNumber?: string; lid?: string };

/** Todas las formas en que puede aparecer un participante (JID, número, LID). */
function idsOf(p: Participant): string[] {
  return [p.id, p.phoneNumber, p.lid].filter((x): x is string => Boolean(x)).map(userPart);
}

export function adminIds(meta: GroupMetadata): string[] {
  return (meta.participants as Participant[])
    .filter((p) => p.admin === 'admin' || p.admin === 'superadmin')
    .map((p) => p.id);
}

export function isAdminIn(meta: GroupMetadata, jid: string): boolean {
  const target = userPart(jid);
  return (meta.participants as Participant[]).some(
    (p) => (p.admin === 'admin' || p.admin === 'superadmin') && idsOf(p).includes(target),
  );
}

export function isMemberIn(meta: GroupMetadata, jid: string): boolean {
  const target = userPart(jid);
  return (meta.participants as Participant[]).some((p) => idsOf(p).includes(target));
}

export function isOwner(jid: string): boolean {
  return config.owners.includes(userPart(jid));
}

export function botIsAdmin(meta: GroupMetadata, sock: WASocket): boolean {
  const me = sock.user?.id;
  return me ? isAdminIn(meta, me) : false;
}
