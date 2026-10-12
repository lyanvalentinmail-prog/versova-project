import { config } from '../config/index.js';
import { getSocket, conn } from '../core/connection.js';
import { logger } from '../utils/logger.js';
import type { ReportRow } from '../database/repos-platform.js';

/**
 * Notifica cada ticket (reporte o sugerencia) al owner:
 * - Por WhatsApp al número del owner (si el bot está vinculado).
 * - Por email al correo del owner (si hay SMTP configurado con MAIL_*).
 *
 * Nunca lanza: un fallo de notificación no debe romper el envío del ticket.
 */
export async function notifyTicket(report: ReportRow): Promise<void> {
  const kind = report.kind === 'report' ? 'Reporte' : 'Sugerencia';
  const body = [
    `🎫 Nuevo ${kind.toLowerCase()} de VÉRSOVA`,
    '',
    `Tipo ⁙ ${kind}`,
    `Usuario ⁙ ${report.username || 'Anónimo'}`,
    `Contacto ⁙ ${report.whatsapp || '—'}`,
    `Fecha ⁙ ${new Date(report.created_at).toLocaleString('es-UY')}`,
    '',
    report.text,
  ].join('\n');

  await sendWhatsAppTicket(body).catch((err) =>
    logger.warn('tickets', `No se pudo avisar por WhatsApp: ${(err as Error).message}`),
  );
  await sendEmailTicket(kind, report, body).catch((err) =>
    logger.warn('tickets', `No se pudo avisar por email: ${(err as Error).message}`),
  );
}

async function sendWhatsAppTicket(text: string): Promise<void> {
  const sock = getSocket();
  if (!sock || conn.status !== 'open') {
    logger.debug('tickets', 'Sin sesión de WhatsApp activa: el aviso al owner va solo por email.');
    return;
  }
  for (const number of config.owners) {
    await sock.sendMessage(`${number}@s.whatsapp.net`, { text });
  }
  logger.info('tickets', `Ticket enviado por WhatsApp a ${config.owners.length} número(s) del owner.`);
}

/** Envia el email solo si hay SMTP configurado; si no, se omite en silencio. */
async function sendEmailTicket(kind: string, report: ReportRow, body: string): Promise<void> {
  const mail = config.mail;
  if (!mail.host || !mail.user || !mail.pass) {
    logger.debug('tickets', 'SMTP no configurado (MAIL_HOST/MAIL_USER/MAIL_PASS): el aviso al owner va solo por WhatsApp.');
    return;
  }
  const nodemailerModule = await import('nodemailer');
  const transporter = nodemailerModule.createTransport({
    host: mail.host,
    port: mail.port,
    secure: mail.secure,
    auth: { user: mail.user, pass: mail.pass },
  });
  await transporter.sendMail({
    from: mail.from,
    to: config.ownerEmail,
    subject: `[VÉRSOVA] ${kind} recibido${report.username ? ` · ${report.username}` : ''}`,
    text: body,
  });
  logger.info('tickets', `Ticket enviado por email a ${config.ownerEmail}.`);
}
