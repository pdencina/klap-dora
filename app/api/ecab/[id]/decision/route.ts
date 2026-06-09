import { NextResponse } from 'next/server';
import { requireUser } from '../../../../../lib/auth';
import { createSupabaseAdmin } from '../../../../../lib/supabase-admin';

export const dynamic = 'force-dynamic';

function requiredManagementApprovals(value?: string | null) {
  if (value === '1_of_3') return 1;
  if (value === '3_of_3') return 3;
  return 2;
}

const nextStatusByDecision: Record<string, Record<string, string>> = {
  rm: { approve: 'management_authorization', observe: 'rm_observed', reject: 'rm_rejected' },
  pre_review: { approve: 'pre_ok', observe: 'pre_observed', reject: 'rm_rejected' },
  management: { approve: 'management_authorization', observe: 'management_observed', reject: 'management_rejected' },
};

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { user, deny } = await requireUser();
  if (deny) return deny;

  const { id } = await context.params;
  const supabase = createSupabaseAdmin();
  const payload = await request.json().catch(() => null);

  if (!payload) return NextResponse.json({ ok: false, error: 'Payload inválido' }, { status: 400 });

  const stage = String(payload.stage || '').trim();
  const decision = String(payload.decision || '').trim();
  let nextStatus = nextStatusByDecision[stage]?.[decision];

  if (!nextStatus) return NextResponse.json({ ok: false, error: 'Decisión o etapa inválida' }, { status: 400 });

  const { data: current, error: currentError } = await supabase
    .from('ecab_requests')
    .select('id, status, approval_rule')
    .eq('id', id)
    .single();

  if (currentError || !current) {
    return NextResponse.json({ ok: false, error: currentError?.message || 'eCAB no encontrado' }, { status: 404 });
  }

  const actorEmail = user?.email || payload.actor_email || null;
  const actorName = payload.actor_name || user?.user_metadata?.full_name || user?.email || null;

  const { error: decisionError } = await supabase.from('ecab_decisions').insert({
    ecab_id: id,
    stage,
    decision,
    comment: payload.comment || null,
    actor_email: actorEmail,
    actor_name: actorName,
  });

  if (decisionError) {
    return NextResponse.json({ ok: false, error: decisionError.message }, { status: 500 });
  }

  let approvedCount = 0;
  const requiredCount = requiredManagementApprovals(current.approval_rule);
  let readyForPap = false;

  if (stage === 'management') {
    const { data: decisions, error: decisionsError } = await supabase
      .from('ecab_decisions')
      .select('actor_name, decision, created_at')
      .eq('ecab_id', id)
      .eq('stage', 'management')
      .order('created_at', { ascending: false });

    if (decisionsError) {
      return NextResponse.json({ ok: false, error: decisionsError.message }, { status: 500 });
    }

    const latestByActor = new Map<string, string>();
    for (const row of decisions || []) {
      const key = String(row.actor_name || '').trim().toLowerCase();
      if (key && !latestByActor.has(key)) latestByActor.set(key, String(row.decision || ''));
    }

    approvedCount = Array.from(latestByActor.values()).filter((value) => value === 'approve').length;

    if (decision === 'approve' && approvedCount >= requiredCount) {
      nextStatus = 'ready_for_pap';
      readyForPap = true;
    }
  }

  const { data: updatedBase, error } = await supabase
    .from('ecab_requests')
    .update({ status: nextStatus, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  await supabase.from('ecab_audit_log').insert({
    ecab_id: id,
    event_type: `decision_${stage}_${decision}`,
    actor_email: actorEmail,
    from_status: current.status,
    to_status: nextStatus,
    detail: payload.comment || `Decisión digital registrada: ${decision}`,
    metadata: {
      stage,
      decision,
      actor_name: actorName,
      approved_count: approvedCount,
      required_count: requiredCount,
      ready_for_pap: readyForPap,
    },
  });

  const { data: updatedWithRelations, error: relationError } = await supabase
    .from('ecab_requests')
    .select('*, ecab_decisions(*), ecab_observations(*)')
    .eq('id', id)
    .single();

  if (relationError) {
    return NextResponse.json({
      ok: true,
      ecab: updatedBase,
      approved_count: approvedCount,
      required_count: requiredCount,
      ready_for_pap: readyForPap,
      warning: relationError.message,
    });
  }

  return NextResponse.json({
    ok: true,
    ecab: updatedWithRelations,
    approved_count: approvedCount,
    required_count: requiredCount,
    ready_for_pap: readyForPap,
  });
}
