import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

async function supabaseServer() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
      },
    },
  );
}

const nextStatusByDecision: Record<string, Record<string, string>> = {
  rm: { approve: 'pre_review', observe: 'rm_observed', reject: 'rm_rejected' },
  pre_review: { approve: 'pre_ok', observe: 'pre_observed', reject: 'rm_rejected' },
  management: { approve: 'ready_for_pap', observe: 'management_observed', reject: 'management_rejected' },
};

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const supabase = await supabaseServer();
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

  await supabase.from('ecab_decisions').insert({
    ecab_id: id,
    stage,
    decision,
    comment: payload.comment || null,
    actor_email: payload.actor_email || null,
    actor_name: payload.actor_name || null,
  });

  await supabase.from('ecab_audit_log').insert({
    ecab_id: id,
    event_type: `decision_${stage}_${decision}`,
    actor_email: payload.actor_email || null,
    from_status: current.status,
    to_status: nextStatus,
    detail: payload.comment || `Decisión digital registrada: ${decision}`,
  });

  return NextResponse.json({ ok: true, ecab: updated });
}
