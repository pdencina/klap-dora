import { NextResponse } from 'next/server';
import { createSupabaseAdmin } from '../../../../lib/supabase-admin';

export const dynamic = 'force-dynamic';

const VALID_ACTIONS = new Set(['APROBADO', 'OBSERVADO', 'RECHAZADO']);

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const approvalId = String(body?.approvalId || '').trim();
    const action = String(body?.action || '').trim().toUpperCase();
    const comment = String(body?.comment || '').trim();

    if (!approvalId) {
      return NextResponse.json({ ok: false, error: 'approvalId requerido' }, { status: 400 });
    }

    if (!VALID_ACTIONS.has(action)) {
      return NextResponse.json({ ok: false, error: 'Acción inválida' }, { status: 400 });
    }

    const supabase = createSupabaseAdmin();

    const { data: approval, error: updateError } = await supabase
      .from('approval_requests')
      .update({
        status: action,
        comment: comment || null,
        approved_at: new Date().toISOString(),
      })
      .eq('id', approvalId)
      .select('*')
      .single();

    if (updateError) {
      return NextResponse.json({ ok: false, error: updateError.message }, { status: 500 });
    }

    const { data: approvals, error: approvalsError } = await supabase
      .from('approval_requests')
      .select('*')
      .eq('rdc_id', approval.rdc_id);

    if (approvalsError) {
      return NextResponse.json({ ok: false, error: approvalsError.message }, { status: 500 });
    }

    let nextStatus = 'PENDIENTE_APROBACIONES';

    if ((approvals || []).some((item) => item.status === 'RECHAZADO')) {
      nextStatus = 'RECHAZADO';
    } else if ((approvals || []).some((item) => item.status === 'OBSERVADO')) {
      nextStatus = 'OBSERVADO';
    } else if ((approvals || []).length > 0 && (approvals || []).every((item) => item.status === 'APROBADO')) {
      nextStatus = 'APROBADO_PARA_EJECUCION';
    }

    const { error: rdcError } = await supabase
      .from('rdc')
      .update({ status: nextStatus, updated_at: new Date().toISOString() })
      .eq('id', approval.rdc_id);

    if (rdcError) {
      return NextResponse.json({ ok: false, error: rdcError.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, approval, rdcStatus: nextStatus });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message || 'Error actualizando aprobación' }, { status: 500 });
  }
}
