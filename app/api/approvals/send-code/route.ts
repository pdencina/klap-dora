import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { createSupabaseAdmin } from '../../../../lib/supabase-admin';

export const dynamic = 'force-dynamic';

async function findApprovalByTokenOrId(supabase: any, token: string) {
  const byToken = await supabase.from('approval_requests').select('*').eq('approval_token', token).maybeSingle();
  if (byToken.data) return { data: byToken.data, error: null };
  const byId = await supabase.from('approval_requests').select('*').eq('id', token).maybeSingle();
  return { data: byId.data, error: byId.error || byToken.error };
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const token = String(body?.token || '').trim();
    if (!token) return NextResponse.json({ ok: false, error: 'Token requerido' }, { status: 400 });

    const supabase = createSupabaseAdmin();
    const { data: approval, error } = await findApprovalByTokenOrId(supabase, token);
    if (error || !approval) return NextResponse.json({ ok: false, error: 'Aprobación no encontrada o token inválido' }, { status: 404 });
    if (approval.status !== 'PENDIENTE') return NextResponse.json({ ok: false, error: `Esta aprobación ya fue procesada con estado ${approval.status}` }, { status: 400 });
    if (!approval.approver_email) return NextResponse.json({ ok: false, error: 'Esta aprobación no tiene correo configurado para enviar OTP' }, { status: 400 });

    const { data: rdc } = await supabase.from('rdc').select('*').eq('id', approval.rdc_id).maybeSingle();
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 10 * 60 * 1000);

    const { error: updateError } = await supabase
      .from('approval_requests')
      .update({
        approval_code: code,
        approval_code_sent_at: now.toISOString(),
        approval_code_expires_at: expiresAt.toISOString(),
        approval_verified_at: null,
      })
      .eq('id', approval.id);

    if (updateError) return NextResponse.json({ ok: false, error: updateError.message }, { status: 500 });

    const resendApiKey = process.env.RESEND_API_KEY;
    const from = process.env.RESEND_FROM || 'Release Portal <onboarding@resend.dev>';
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || '';

    if (resendApiKey) {
      const resend = new Resend(resendApiKey);
      await resend.emails.send({
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
    }

    return NextResponse.json({
      ok: true,
      message: resendApiKey ? 'Código enviado al correo del aprobador' : 'Código generado. Falta configurar RESEND_API_KEY para enviar correo.',
      sentTo: approval.approver_email,
      expiresAt: expiresAt.toISOString(),
      debugCode: resendApiKey ? undefined : code,
    });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message || 'Error enviando código' }, { status: 500 });
  }
}
