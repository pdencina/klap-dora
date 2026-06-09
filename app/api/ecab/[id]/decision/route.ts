import { NextResponse } from 'next/server';
import { requireUser } from '../../../../../lib/auth';
import { createSupabaseAdmin } from '../../../../../lib/supabase-admin';

export const dynamic = 'force-dynamic';

const nextStatusByDecision: Record<string, Record<string, string>> = {
  rm: { approve: 'management_authorization', observe: 'rm_observed', reject: 'rm_rejected' },
  pre_review: { approve: 'pre_ok', observe: 'pre_observed', reject: 'rm_rejected' },
  management: { approve: 'ready_for_pap', observe: 'management_observed', reject: 'management_rejected' },
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
  const nextStatus = nextStatusByDecision[stage]?.[decision];

  if (!nextStatus) return NextResponse.json({ ok: false, error: 'Decisión o etapa inválida' }, { status: 400 });

  const { data: current, error: currentError } = await supabase
    .from('ecab_requests')
    .select('id, status')
    .eq('id', id)
    .single();

  if (currentError || !current) {
    return NextResponse.json({ ok: false, error: currentError?.message || 'eCAB no encontrado' }, { status: 404 });
  }

  const { data: updated, error } = await supabase
    .from('ecab_requests')
    .update({ status: nextStatus, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  const actorEmail = user?.email || payload.actor_email || null;
  const actorName = payload.actor_name || user?.user_metadata?.full_name || user?.email || null;

  await supabase.from('ecab_decisions').insert({
    ecab_id: id,
    stage,
    decision,
    comment: payload.comment || null,
    actor_email: actorEmail,
    actor_name: actorName,
  });

  await supabase.from('ecab_audit_log').insert({
    ecab_id: id,
    event_type: `decision_${stage}_${decision}`,
    actor_email: actorEmail,
    from_status: current.status,
    to_status: nextStatus,
    detail: payload.comment || `Decisión digital registrada: ${decision}`,
  });

  return NextResponse.json({ ok: true, ecab: updated });
}
