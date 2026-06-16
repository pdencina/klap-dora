import { NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase-admin';
import { computeRdcStatus } from '@/lib/rdc-status';
import { notifyApprovalDecision, notifyRdcFullyApproved, notifyRdcRejected } from '@/lib/notifications';

export const dynamic = 'force-dynamic';
const VALID_ACTIONS = new Set(['APROBADO', 'OBSERVADO', 'RECHAZADO']);

async function findApprovalByTokenOrId(supabase: any, token: string) {
  const byToken = await supabase.from('approval_requests').select('*').eq('approval_token', token).maybeSingle();
  if (byToken.data) return { data: byToken.data, error: null };
  const byId = await supabase.from('approval_requests').select('*').eq('id', token).maybeSingle();
  return { data: byId.data, error: byId.error || byToken.error };
}

function getClientIp(req: Request) {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || null;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const token = String(body?.token || '').trim();
    const action = String(body?.action || '').trim().toUpperCase();
    const comment = String(body?.comment || '').trim();

    if (!token) return NextResponse.json({ ok: false, error: 'Token requerido' }, { status: 400 });
    if (!VALID_ACTIONS.has(action)) return NextResponse.json({ ok: false, error: 'Acción inválida' }, { status: 400 });

    const supabase = createSupabaseAdmin();
    const { data: currentApproval, error: currentError } = await findApprovalByTokenOrId(supabase, token);
    if (currentError || !currentApproval) return NextResponse.json({ ok: false, error: 'Aprobación no encontrada o token inválido' }, { status: 404 });
    if (currentApproval.status !== 'PENDIENTE') return NextResponse.json({ ok: false, error: `Esta aprobación ya fue procesada con estado ${currentApproval.status}` }, { status: 400 });
    if (!currentApproval.approval_verified_at) return NextResponse.json({ ok: false, error: 'Debes validar el código enviado al correo antes de aprobar.' }, { status: 403 });

    const now = new Date().toISOString();
    const { data: approval, error: updateError } = await supabase
      .from('approval_requests')
      .update({
        status: action,
        comment: comment || null,
        approved_at: now,
        approved_by_name: currentApproval.approver_name || null,
        approved_by_email: currentApproval.approver_email || null,
        approved_ip: getClientIp(req),
        approved_user_agent: req.headers.get('user-agent') || null,
      })
      .eq('id', currentApproval.id)
      .select('*')
      .single();

    if (updateError) return NextResponse.json({ ok: false, error: updateError.message }, { status: 500 });

    const { data: approvals, error: approvalsError } = await supabase.from('approval_requests').select('*').eq('rdc_id', approval.rdc_id);
    if (approvalsError) return NextResponse.json({ ok: false, error: approvalsError.message }, { status: 500 });

    const nextStatus = computeRdcStatus(approvals || []);

    const { error: rdcError } = await supabase.from('rdc').update({ status: nextStatus, updated_at: now }).eq('id', approval.rdc_id);
    if (rdcError) return NextResponse.json({ ok: false, error: rdcError.message }, { status: 500 });

    // === Notificaciones por email ===
    const notifyPromises: Promise<any>[] = [];

    // Buscar datos del RDC para notificar al creador
    const { data: rdc } = await supabase.from('rdc').select('title, created_by').eq('id', approval.rdc_id).single();

    if (rdc?.created_by) {
      notifyPromises.push(
        notifyApprovalDecision({
          rdcTitle: rdc.title || 'RDC',
          rdcId: approval.rdc_id,
          creatorEmail: rdc.created_by,
          approverName: approval.approved_by_name || approval.approver_name || '',
          approverRole: approval.approver_role || '',
          decision: action as 'APROBADO' | 'OBSERVADO' | 'RECHAZADO',
          comment: comment || undefined,
        })
      );
    }

    // Si quedó completamente aprobado, notificar
    if (nextStatus === 'APROBADO_PARA_EJECUCION' && rdc?.created_by) {
      notifyPromises.push(
        notifyRdcFullyApproved({
          rdcTitle: rdc.title || 'RDC',
          rdcId: approval.rdc_id,
          recipients: [rdc.created_by],
        })
      );
    }

    // Si fue rechazado, notificar
    if (nextStatus === 'RECHAZADO' && rdc?.created_by) {
      notifyPromises.push(
        notifyRdcRejected({
          rdcTitle: rdc.title || 'RDC',
          rdcId: approval.rdc_id,
          recipients: [rdc.created_by],
          rejectedBy: approval.approved_by_name || approval.approver_name || approval.approver_role || '',
          comment: comment || undefined,
        })
      );
    }

    Promise.allSettled(notifyPromises).catch(() => {});

    return NextResponse.json({ ok: true, approval, rdcStatus: nextStatus });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message || 'Error procesando aprobación' }, { status: 500 });
  }
}
