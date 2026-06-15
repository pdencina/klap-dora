import { NextResponse } from 'next/server';
import { requireActionPermission } from '@/lib/auth';
import { createSupabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

function parseDate(value?: string | null) {
  if (!value) return null;
  const raw = String(value).trim();
  if (!raw) return null;

  const isoMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;

  const clMatch = raw.match(/^(\d{1,2})-(\d{1,2})(?:-(\d{4}))?/);
  if (clMatch) {
    const day = clMatch[1].padStart(2, '0');
    const month = clMatch[2].padStart(2, '0');
    const year = clMatch[3] || String(new Date().getFullYear());
    return `${year}-${month}-${day}`;
  }

  return null;
}

function approvalSummary(decisions: any[]) {
  const management = (decisions || []).filter((decision) => decision.stage === 'management');
  const approved = new Set<string>();

  for (const decision of management) {
    if (decision.decision === 'approve' && decision.actor_name) {
      approved.add(String(decision.actor_name).trim().toLowerCase());
    }
  }

  return approved.size;
}

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { user, deny } = await requireActionPermission('edit_pap');
  if (deny) return deny;

  const { id } = await context.params;
  const supabase = createSupabaseAdmin();

  const { data: ecab, error: ecabError } = await supabase
    .from('ecab_requests')
    .select('*, ecab_decisions(*)')
    .eq('id', id)
    .single();

  if (ecabError || !ecab) {
    return NextResponse.json({ ok: false, error: ecabError?.message || 'eCAB no encontrado' }, { status: 404 });
  }

  if (ecab.status !== 'ready_for_pap' && ecab.status !== 'pap_created') {
    return NextResponse.json({ ok: false, error: 'El eCAB aún no está listo para crear Plan PAP.' }, { status: 400 });
  }

  if (ecab.rdc_id) {
    const { data: existingRdc } = await supabase
      .from('rdc')
      .select('id')
      .eq('id', ecab.rdc_id)
      .maybeSingle();

    if (existingRdc?.id) {
      return NextResponse.json({ ok: true, existing: true, rdc_id: existingRdc.id, ecab });
    }
  }

  const proposedDate = parseDate(ecab.proposed_deploy_at);
  const validationDate = parseDate(ecab.post_validation_at);
  const managementApproved = approvalSummary(ecab.ecab_decisions || []);
  const title = `[eCAB] ${ecab.title}`;

  const rdcPayload: any = {
    title,
    description: ecab.urgency_reason || 'Plan PAP creado desde eCAB.',
    category: 'ECAB',
    system: ecab.system || null,
    cell: ecab.cell || null,
    status: 'APROBADO_PARA_EJECUCION',
    created_by: user?.email || ecab.created_by || null,
    presenter: ecab.created_by || user?.email || null,
    technical_lead: ecab.technical_lead || null,
    business_validator: ecab.validator || null,
    jira_origin: ecab.jira_or_erfc_url || null,
    proposed_deploy_date: proposedDate,
    validation_date: validationDate,
    deployment_result: 'PENDIENTE',
  };

  const { data: rdc, error: rdcError } = await supabase
    .from('rdc')
    .insert(rdcPayload)
    .select()
    .single();

  if (rdcError || !rdc) {
    return NextResponse.json({ ok: false, error: rdcError?.message || 'No fue posible crear RDC/PAP desde eCAB' }, { status: 500 });
  }

  const formData = {
    source_type: 'ECAB',
    ecab_id: ecab.id,
    ecab_status: ecab.status,
    approval_rule: ecab.approval_rule,
    management_approved_count: managementApproved,
    urgency_reason: ecab.urgency_reason,
    problem: ecab.problem,
    solution: ecab.solution,
    risk: ecab.risk,
    impact: ecab.impact,
    affected_systems: ecab.affected_systems,
    jira_or_erfc_url: ecab.jira_or_erfc_url,
    proposed_deploy_at: ecab.proposed_deploy_at,
    post_validation_at: ecab.post_validation_at,
    production_validation_plan: ecab.production_validation_plan,
    validator: ecab.validator,
  };

  await supabase.from('rdc_details').insert({
    rdc_id: rdc.id,
    requirement_description: ecab.problem || ecab.urgency_reason,
    implemented_solution: ecab.solution,
    affected_services: ecab.affected_systems,
    affected_users: ecab.impact,
    consequence_not_implementing: ecab.urgency_reason,
    validation_plan: ecab.production_validation_plan,
    deployment_plan: `Planificar paso productivo asociado a eCAB aprobado.\nSistema: ${ecab.system || 'Pendiente'}\nValidador: ${ecab.validator || 'Pendiente'}`,
    rollback_plan: ecab.risk,
    impact: 'Alto',
    priority: 'Urgente',
    form_version: 'ecab_to_pap_v1',
    form_data: formData,
  });

  const defaultSteps = [
    {
      rdc_id: rdc.id,
      step_order: 1,
      activity: 'Confirmar precondiciones del eCAB aprobado y ventana de implementación',
      responsible: 'Release Management',
      planned_time: '21:30',
      status: 'Pendiente definir',
      notes: `Origen eCAB: ${ecab.title}`,
    },
    {
      rdc_id: rdc.id,
      step_order: 2,
      activity: 'Ejecutar actividades técnicas del despliegue eCAB',
      responsible: ecab.technical_lead || 'Líder técnico',
      planned_time: '22:00',
      status: 'Pendiente definir',
      notes: ecab.solution || '',
    },
    {
      rdc_id: rdc.id,
      step_order: 3,
      activity: 'Ejecutar validación productiva del eCAB',
      responsible: ecab.validator || 'Validador',
      planned_time: '23:00',
      status: 'Pendiente definir',
      notes: ecab.production_validation_plan || '',
    },
    {
      rdc_id: rdc.id,
      step_order: 4,
      activity: 'Registrar evidencia, resultado y preparar cierre',
      responsible: 'Release Management',
      planned_time: '23:30',
      status: 'Pendiente definir',
      notes: 'Validar evidencia antes de pasar a Deploy Center/Cierre.',
    },
  ];

  const { error: stepsError } = await supabase.from('pap_steps').insert(defaultSteps);
  if (stepsError) {
    return NextResponse.json({ ok: false, error: `PAP creado, pero falló la creación de actividades: ${stepsError.message}` }, { status: 500 });
  }

  const { data: updatedEcab, error: updateError } = await supabase
    .from('ecab_requests')
    .update({ rdc_id: rdc.id, status: 'pap_created', updated_at: new Date().toISOString() })
    .eq('id', ecab.id)
    .select('*, ecab_decisions(*), ecab_observations(*)')
    .single();

  if (updateError) {
    return NextResponse.json({ ok: true, rdc_id: rdc.id, ecab, warning: `PAP creado, pero no se pudo actualizar eCAB: ${updateError.message}` });
  }

  await supabase.from('ecab_audit_log').insert({
    ecab_id: ecab.id,
    event_type: 'pap_created',
    actor_email: user?.email || null,
    from_status: ecab.status,
    to_status: 'pap_created',
    detail: 'Plan PAP creado desde eCAB aprobado.',
    metadata: { rdc_id: rdc.id, source_type: 'ECAB' },
  });

  return NextResponse.json({ ok: true, existing: false, rdc_id: rdc.id, ecab: updatedEcab });
}
