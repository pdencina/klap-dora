import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { createSupabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

async function findApprovalByTokenOrId(supabase: any, token: string) {
  const byToken = await supabase.from('approval_requests').select('*').eq('approval_token', token).maybeSingle();
  if (byToken.data) return { data: byToken.data, error: null };

  const byId = await supabase.from('approval_requests').select('*').eq('id', token).maybeSingle();
  return { data: byId.data, error: byId.error || byToken.error };
}

function isMissingColumn(error: any) {
  const message = String(error?.message || error?.details || '').toLowerCase();
  return message.includes('column') || message.includes('schema cache') || message.includes('could not find');
}

async function updateOtpSafely(supabase: any, approvalId: string, payload: Record<string, any>) {
  const attempts: Record<string, any>[] = [
    payload,
    {
      approval_code: payload.approval_code,
      approval_code_sent_at: payload.approval_code_sent_at,
      approval_verified_at: payload.approval_verified_at,
    },
    {
      approval_code: payload.approval_code,
      approval_code_sent_at: payload.approval_code_sent_at,
    },
    {
      approval_code: payload.approval_code,
    },
  ];

  let lastError: any = null;

  for (const attempt of attempts) {
    const { error } = await supabase
      .from('approval_requests')
      .update(attempt)
      .eq('id', approvalId);

    if (!error) {
      return { ok: true, usedPayload: attempt, error: null };
    }

    lastError = error;

    if (!isMissingColumn(error)) {
      break;
    }
  }

  return { ok: false, usedPayload: null, error: lastError };
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const token = String(body?.token || '').trim();

    if (!token) {
      return NextResponse.json({ ok: false, error: 'Token requerido' }, { status: 400 });
    }

    const supabase = createSupabaseAdmin();
    const { data: approval, error } = await findApprovalByTokenOrId(supabase, token);

    if (error || !approval) {
      return NextResponse.json({ ok: false, error: 'Aprobación no encontrada o token inválido' }, { status: 404 });
    }

    if (approval.status !== 'PENDIENTE') {
      return NextResponse.json({ ok: false, error: `Esta aprobación ya fue procesada con estado ${approval.status}` }, { status: 400 });
    }

    if (!approval.approver_email) {
      return NextResponse.json({ ok: false, error: 'Esta aprobación no tiene correo configurado para enviar OTP' }, { status: 400 });
    }

    const { data: rdc } = await supabase.from('rdc').select('*').eq('id', approval.rdc_id).maybeSingle();

    const code = String(Math.floor(100000 + Math.random() * 900000));
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 10 * 60 * 1000);

    const updateResult = await updateOtpSafely(supabase, approval.id, {
      approval_code: code,
      approval_code_sent_at: now.toISOString(),
      approval_code_expires_at: expiresAt.toISOString(),
      approval_verified_at: null,
    });

    if (!updateResult.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: updateResult.error?.message || 'No fue posible guardar el código OTP en la base de datos',
        },
        { status: 500 },
      );
    }

    const resendApiKey = process.env.RESEND_API_KEY;
    const from = process.env.RESEND_FROM || 'Release Portal <onboarding@resend.dev>';
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || '';
    let emailSent = false;
    let emailError = '';

    if (resendApiKey) {
      try {
        const resend = new Resend(resendApiKey);
        const result = await resend.emails.send({
          from,
          to: approval.approver_email,
          subject: `Código de aprobación - ${rdc?.title || 'RDC'}`,
          html: `<div style="font-family:Arial,sans-serif;color:#073b5d;line-height:1.45">
            <h2>Aprobación digital pendiente</h2>
            <p>Hola ${approval.approver_name || ''},</p>
            <p>Tienes una aprobación pendiente en el Release Portal.</p>
            <p><b>Cambio:</b> ${rdc?.title || 'Sin título'}</p>
            <p><b>Área:</b> ${approval.approver_role}</p>
            <p style="font-size:28px;letter-spacing:6px;font-weight:800;background:#f2f7fa;padding:16px;border-radius:12px;display:inline-block">${code}</p>
            <p>Este código expira en 10 minutos.</p>
            ${baseUrl ? `<p><a href="${baseUrl}/approve/${approval.approval_token || approval.id}">Abrir aprobación</a></p>` : ''}
          </div>`,
        });

        if ((result as any)?.error) {
          emailError = (result as any).error?.message || 'Resend rechazó el envío';
        } else {
          emailSent = true;
        }
      } catch (err: any) {
        emailError = err?.message || 'Resend no pudo enviar el correo';
      }
    }

    if (resendApiKey && !emailSent) {
      return NextResponse.json(
        {
          ok: false,
          error: `Código generado, pero no fue posible enviar el correo: ${emailError || 'error desconocido de Resend'}`,
        },
        { status: 502 },
      );
    }

    return NextResponse.json({
      ok: true,
      message: emailSent
        ? 'Código enviado al correo del aprobador'
        : 'Código generado. Falta configurar RESEND_API_KEY para enviar correo.',
      sentTo: approval.approver_email,
      expiresAt: expiresAt.toISOString(),
      debugCode: resendApiKey ? undefined : code,
    });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message || 'Error enviando código' }, { status: 500 });
  }
}
