/**
 * Servicio de notificaciones por email.
 * Usa Resend para enviar emails a los correos corporativos.
 *
 * Configuración env:
 * - RESEND_API_KEY: API key de Resend
 * - RESEND_FROM: Remitente (ej: "Release Portal <release@klap.cl>")
 * - NEXT_PUBLIC_APP_URL: URL base de la app (para links en emails)
 */

import { Resend } from 'resend';

const FROM = process.env.RESEND_FROM || 'Release Portal KLAP <onboarding@resend.dev>';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://klap-dora.vercel.app';

function getResend() {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  return new Resend(key);
}

// ===== Templates de email =====

function baseTemplate(title: string, body: string, ctaUrl?: string, ctaLabel?: string): string {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f2f7fa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:40px 24px;">
    <div style="background:#fff;border-radius:16px;border:1px solid #dfeaf0;padding:32px;box-shadow:0 4px 24px rgba(7,59,93,.06);">
      <div style="margin-bottom:24px;">
        <span style="color:#00a85f;font-weight:900;font-size:22px;letter-spacing:-0.03em;">klap</span>
        <span style="color:#5d7890;font-size:11px;font-weight:700;letter-spacing:0.1em;margin-left:8px;">RELEASE</span>
      </div>
      <h1 style="color:#073b5d;font-size:22px;margin:0 0 16px;line-height:1.3;">${title}</h1>
      <div style="color:#315873;font-size:15px;line-height:1.6;">${body}</div>
      ${ctaUrl ? `
      <div style="margin-top:24px;">
        <a href="${ctaUrl}" style="display:inline-block;background:#00c16e;color:#fff;text-decoration:none;padding:14px 24px;border-radius:999px;font-weight:800;font-size:14px;">${ctaLabel || 'Ver en portal'}</a>
      </div>` : ''}
    </div>
    <p style="text-align:center;color:#91a4b6;font-size:12px;margin-top:20px;">
      Release Management Portal · KLAP
    </p>
  </div>
</body>
</html>`;
}

// ===== Funciones de notificación =====

export interface NotifyResult {
  sent: boolean;
  error?: string;
}

async function send(to: string | string[], subject: string, html: string): Promise<NotifyResult> {
  const resend = getResend();
  if (!resend) {
    console.log(`[notifications] RESEND_API_KEY not configured. Would send to: ${to}, subject: ${subject}`);
    return { sent: false, error: 'RESEND_API_KEY no configurada' };
  }

  const recipients = Array.isArray(to) ? to : [to];
  const validRecipients = recipients.filter((email) => email && email.includes('@'));

  if (!validRecipients.length) {
    return { sent: false, error: 'No hay destinatarios válidos' };
  }

  try {
    const result = await resend.emails.send({
      from: FROM,
      to: validRecipients,
      subject,
      html,
    });

    if ((result as any)?.error) {
      return { sent: false, error: (result as any).error?.message || 'Error de Resend' };
    }

    return { sent: true };
  } catch (err: any) {
    return { sent: false, error: err?.message || 'Error enviando email' };
  }
}

// ===== Notificaciones por evento =====

/**
 * Notifica a los aprobadores que tienen una aprobación pendiente.
 */
export async function notifyApprovalPending(params: {
  rdcTitle: string;
  rdcId: string;
  approverEmail: string;
  approverName: string;
  approverRole: string;
  approvalToken: string;
}) {
  const { rdcTitle, rdcId, approverEmail, approverName, approverRole, approvalToken } = params;

  const body = `
    <p>Hola <strong>${approverName}</strong>,</p>
    <p>Se te ha asignado una aprobación para el siguiente cambio:</p>
    <div style="background:#f8fbfd;border:1px solid #e5eef3;border-radius:12px;padding:16px;margin:16px 0;">
      <p style="margin:0 0 8px;"><strong>RDC:</strong> ${rdcTitle}</p>
      <p style="margin:0 0 8px;"><strong>Tu rol:</strong> ${approverRole}</p>
    </div>
    <p>Para revisar y tomar una decisión, ingresa al siguiente enlace y valida tu identidad con el código OTP que recibirás:</p>
  `;

  return send(
    approverEmail,
    `🔔 Aprobación pendiente: ${rdcTitle}`,
    baseTemplate('Aprobación pendiente', body, `${APP_URL}/approve/${approvalToken}`, 'Revisar aprobación'),
  );
}

/**
 * Notifica al creador del RDC cuando un aprobador toma decisión.
 */
export async function notifyApprovalDecision(params: {
  rdcTitle: string;
  rdcId: string;
  creatorEmail: string;
  approverName: string;
  approverRole: string;
  decision: 'APROBADO' | 'OBSERVADO' | 'RECHAZADO';
  comment?: string;
}) {
  const { rdcTitle, rdcId, creatorEmail, approverName, approverRole, decision, comment } = params;

  const statusColor = decision === 'APROBADO' ? '#008f57' : decision === 'OBSERVADO' ? '#9a6700' : '#b42318';
  const statusBg = decision === 'APROBADO' ? '#e8fff3' : decision === 'OBSERVADO' ? '#fff7e6' : '#fff1f0';

  const body = `
    <p>Se ha registrado una decisión en tu RDC:</p>
    <div style="background:#f8fbfd;border:1px solid #e5eef3;border-radius:12px;padding:16px;margin:16px 0;">
      <p style="margin:0 0 8px;"><strong>RDC:</strong> ${rdcTitle}</p>
      <p style="margin:0 0 8px;"><strong>Aprobador:</strong> ${approverName} (${approverRole})</p>
      <p style="margin:0;">
        <strong>Decisión:</strong>
        <span style="background:${statusBg};color:${statusColor};padding:4px 10px;border-radius:999px;font-weight:800;font-size:13px;">${decision}</span>
      </p>
      ${comment ? `<p style="margin:12px 0 0;color:#5d7890;font-style:italic;">"${comment}"</p>` : ''}
    </div>
  `;

  return send(
    creatorEmail,
    `${decision === 'APROBADO' ? '✅' : decision === 'OBSERVADO' ? '⚠️' : '❌'} ${approverRole} ${decision.toLowerCase()}: ${rdcTitle}`,
    baseTemplate(`Decisión de aprobación: ${decision}`, body, `${APP_URL}/rdc/${rdcId}`, 'Ver estado del RDC'),
  );
}

/**
 * Notifica cuando un RDC queda completamente aprobado.
 */
export async function notifyRdcFullyApproved(params: {
  rdcTitle: string;
  rdcId: string;
  recipients: string[];
}) {
  const { rdcTitle, rdcId, recipients } = params;

  const body = `
    <p>Todas las aprobaciones han sido completadas para el siguiente cambio:</p>
    <div style="background:#e8fff3;border:1px solid #bbf7d0;border-radius:12px;padding:16px;margin:16px 0;">
      <p style="margin:0;font-size:18px;"><strong>✅ ${rdcTitle}</strong></p>
      <p style="margin:8px 0 0;color:#008f57;font-weight:700;">Aprobado para ejecución</p>
    </div>
    <p>El cambio está listo para avanzar al Plan PAP y posterior ejecución.</p>
  `;

  return send(
    recipients,
    `✅ RDC aprobado para ejecución: ${rdcTitle}`,
    baseTemplate('RDC aprobado para ejecución', body, `${APP_URL}/rdc/${rdcId}`, 'Ver RDC aprobado'),
  );
}

/**
 * Notifica cuando se crea un nuevo RDC.
 */
export async function notifyRdcCreated(params: {
  rdcTitle: string;
  rdcId: string;
  creatorEmail: string;
  creatorName: string;
  system: string;
  category: string;
}) {
  const { rdcTitle, rdcId, creatorEmail, creatorName, system, category } = params;

  const body = `
    <p>Se ha registrado un nuevo cambio en el portal:</p>
    <div style="background:#f8fbfd;border:1px solid #e5eef3;border-radius:12px;padding:16px;margin:16px 0;">
      <p style="margin:0 0 8px;"><strong>RDC:</strong> ${rdcTitle}</p>
      <p style="margin:0 0 8px;"><strong>Sistema:</strong> ${system || 'No especificado'}</p>
      <p style="margin:0 0 8px;"><strong>Categoría:</strong> ${category || 'No especificada'}</p>
      <p style="margin:0;"><strong>Creado por:</strong> ${creatorName}</p>
    </div>
    <p>Las aprobaciones CAB ya fueron generadas. Los aprobadores recibirán sus notificaciones.</p>
  `;

  return send(
    creatorEmail,
    `📋 RDC creado: ${rdcTitle}`,
    baseTemplate('RDC registrado exitosamente', body, `${APP_URL}/rdc/${rdcId}`, 'Ver mi RDC'),
  );
}

/**
 * Notifica cuando un cambio es rechazado.
 */
export async function notifyRdcRejected(params: {
  rdcTitle: string;
  rdcId: string;
  recipients: string[];
  rejectedBy: string;
  comment?: string;
}) {
  const { rdcTitle, rdcId, recipients, rejectedBy, comment } = params;

  const body = `
    <p>Un cambio ha sido <strong style="color:#b42318;">rechazado</strong>:</p>
    <div style="background:#fff1f0;border:1px solid #fecaca;border-radius:12px;padding:16px;margin:16px 0;">
      <p style="margin:0 0 8px;"><strong>RDC:</strong> ${rdcTitle}</p>
      <p style="margin:0 0 8px;"><strong>Rechazado por:</strong> ${rejectedBy}</p>
      ${comment ? `<p style="margin:8px 0 0;color:#5d7890;font-style:italic;">"${comment}"</p>` : ''}
    </div>
    <p>El cambio no puede avanzar en su estado actual. Revisa las observaciones y corrige lo necesario.</p>
  `;

  return send(
    recipients,
    `❌ RDC rechazado: ${rdcTitle}`,
    baseTemplate('RDC rechazado', body, `${APP_URL}/rdc/${rdcId}`, 'Ver observaciones'),
  );
}
