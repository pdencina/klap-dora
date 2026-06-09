import { NextResponse } from 'next/server';
import { requireUser } from '../../../lib/auth';
import { createSupabaseAdmin } from '../../../lib/supabase-admin';

export const dynamic = 'force-dynamic';

const requiredFields = [
  'urgency_reason',
  'problem',
  'solution',
  'risk',
  'impact',
  'proposed_deploy_at',
  'post_validation_at',
  'validator',
  'production_validation_plan',
  'affected_systems',
  'jira_or_erfc_url',
];

function validatePayload(payload: any) {
  return requiredFields.filter((field) => !String(payload?.[field] || '').trim());
}

export async function GET() {
  const { user, deny } = await requireUser();
  if (deny) return deny;

  const supabase = createSupabaseAdmin();

  const { data, error } = await supabase
    .from('ecab_requests')
    .select('*, ecab_decisions(*), ecab_observations(*)')
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, ecabs: data || [] });
}

export async function POST(request: Request) {
  const { user, deny } = await requireUser();
  if (deny) return deny;

  const supabase = createSupabaseAdmin();
  const payload = await request.json().catch(() => null);

  if (!payload) return NextResponse.json({ ok: false, error: 'Payload inválido' }, { status: 400 });

  const missing = validatePayload(payload);
  if (missing.length) {
    return NextResponse.json({ ok: false, error: 'Faltan campos obligatorios', missing }, { status: 400 });
  }

  const actorEmail = user?.email || payload.created_by || null;

  const requestPayload = {
    rdc_id: payload.rdc_id || null,
    title: payload.title || payload.change_name || 'Solicitud eCAB',
    system: payload.system || null,
    cell: payload.cell || null,
    technical_lead: payload.technical_lead || null,
    validator: payload.validator || null,
    urgency_reason: payload.urgency_reason,
    problem: payload.problem,
    solution: payload.solution,
    risk: payload.risk,
    impact: payload.impact,
    proposed_deploy_at: payload.proposed_deploy_at,
    post_validation_at: payload.post_validation_at,
    production_validation_plan: payload.production_validation_plan,
    affected_systems: payload.affected_systems,
    jira_or_erfc_url: payload.jira_or_erfc_url,
    approval_rule: payload.approval_rule || '2_of_3',
    status: 'rm_review',
    created_by: actorEmail,
  };

  const { data, error } = await supabase
    .from('ecab_requests')
    .insert(requestPayload)
    .select()
    .single();

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  const { error: auditError } = await supabase.from('ecab_audit_log').insert({
    ecab_id: data.id,
    event_type: 'created',
    actor_email: actorEmail,
    from_status: null,
    to_status: 'rm_review',
    detail: 'Solicitud eCAB creada y enviada a revisión Release Manager.',
  });

  if (auditError) {
    return NextResponse.json({
      ok: true,
      ecab: data,
      warning: `eCAB creado, pero no se pudo registrar auditoría: ${auditError.message}`,
    });
  }

  return NextResponse.json({ ok: true, ecab: data });
}
