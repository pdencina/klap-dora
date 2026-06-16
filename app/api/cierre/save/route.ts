import { NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase-admin';
import { requireModuleAccess } from '@/lib/auth';

export const dynamic = 'force-dynamic';

function mapRdcStatus(result: string, hadRollback: boolean, hadIncident: boolean) {
  if (hadRollback || result === 'Rollback') return 'ROLLBACK';
  if (hadIncident || result === 'Con incidente' || result === 'Fallido') return 'IMPLEMENTADO_CON_INCIDENTE';
  if (result === 'Exitoso') return 'IMPLEMENTADO_EXITOSO';
  return 'CERRADO';
}

export async function POST(req: Request) {
  const { user, deny } = await requireModuleAccess('cierre');
  if (deny) return deny;

  const body = await req.json();

  const rdcId = String(body?.rdcId || '').trim();
  const closureId = body?.closureId ? String(body.closureId).trim() : '';
  const result = String(body?.result || '').trim();
  const realStartAt = body?.realStartAt || null;
  const realEndAt = body?.realEndAt || null;
  const hadRollback = Boolean(body?.hadRollback);
  const hadIncident = Boolean(body?.hadIncident);
  const incidentJira = String(body?.incidentJira || '').trim();
  const qaValidation = String(body?.qaValidation || '').trim();
  const businessValidation = String(body?.businessValidation || '').trim();
  const technicalValidation = String(body?.technicalValidation || '').trim();
  const observations = String(body?.observations || '').trim();
  const serviceImpact = String(body?.serviceImpact || '').trim();
  const deploymentRunId = body?.deploymentRunId ? String(body.deploymentRunId).trim() : null;

  if (!rdcId) return NextResponse.json({ ok: false, error: 'Falta rdcId' }, { status: 400 });
  if (!result) return NextResponse.json({ ok: false, error: 'Falta resultado del cierre' }, { status: 400 });

  const supabase = createSupabaseAdmin();

  const payload = {
    rdc_id: rdcId,
    deployment_run_id: deploymentRunId,
    result,
    real_start_at: realStartAt,
    real_end_at: realEndAt,
    had_rollback: hadRollback || result === 'Rollback',
    had_incident: hadIncident || result === 'Con incidente' || result === 'Fallido',
    incident_jira: incidentJira || null,
    qa_validation: qaValidation,
    business_validation: businessValidation,
    technical_validation: technicalValidation,
    service_impact: serviceImpact,
    observations,
    closed_by: user?.email || null,
    closed_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  let closure;

  if (closureId) {
    const { data, error } = await supabase
      .from('change_closures')
      .update(payload)
      .eq('id', closureId)
      .select('*')
      .single();

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    closure = data;
  } else {
    const { data, error } = await supabase
      .from('change_closures')
      .insert(payload)
      .select('*')
      .single();

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    closure = data;
  }

  const rdcStatus = mapRdcStatus(result, hadRollback, hadIncident);

  await supabase
    .from('rdc')
    .update({
      status: rdcStatus,
      updated_at: new Date().toISOString(),
    })
    .eq('id', rdcId);

  if (deploymentRunId && result) {
    await supabase
      .from('deployment_runs')
      .update({
        status: result === 'Exitoso' ? 'SUCCESS' : result === 'Rollback' ? 'ABORTED' : 'FAILURE',
        result: result === 'Exitoso' ? 'SUCCESS' : result === 'Rollback' ? 'ABORTED' : 'FAILURE',
        finished_at: realEndAt || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', deploymentRunId);
  }

  return NextResponse.json({ ok: true, closure, rdcStatus });
}
