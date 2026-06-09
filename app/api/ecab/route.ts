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
  const supabase = await supabaseServer();

  const { data, error } = await supabase
    .from('ecab_requests')
    .select('*, ecab_decisions(*), ecab_observations(*)')
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, ecabs: data || [] });
}

export async function POST(request: Request) {
  const supabase = await supabaseServer();
  const payload = await request.json().catch(() => null);

  if (!payload) return NextResponse.json({ ok: false, error: 'Payload inválido' }, { status: 400 });

  const missing = validatePayload(payload);
  if (missing.length) {
    return NextResponse.json({ ok: false, error: 'Faltan campos obligatorios', missing }, { status: 400 });
  }

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
    status: 'rm_review',
    approval_rule: payload.approval_rule || '2_of_3',
    created_by: payload.created_by || null,
  };

  const { data, error } = await supabase.from('ecab_requests').insert(requestPayload).select().single();
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  await supabase.from('ecab_audit_log').insert({
    ecab_id: data.id,
    event_type: 'created',
    actor_email: payload.created_by || null,
    from_status: null,
    to_status: 'rm_review',
    detail: 'Solicitud eCAB creada y enviada a revisión Release Manager.',
  });

  return NextResponse.json({ ok: true, ecab: data });
}
