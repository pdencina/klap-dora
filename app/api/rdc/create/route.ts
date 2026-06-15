import { NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase-admin';
import { requireUser, roleOf } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const DEFAULT_APPROVERS = ['Dueño Cambio', 'QA', 'DBA', 'Deployment'];

function clean(value: any) {
  return String(value || '').trim();
}

function traceabilityRows(rdcId: string, body: any, userEmail?: string | null) {
  const items = [
    { type: 'QA_NOTE', area: 'QA', title: 'Notas QA / pruebas', description: body?.qaNotes },
    { type: 'DBA_NOTE', area: 'DBA', title: 'Notas DBA', description: body?.dbaNotes },
    { type: 'SECURITY_NOTE', area: 'Seguridad', title: 'Notas Seguridad', description: body?.securityNotes },
    { type: 'INFRA_NOTE', area: 'Infraestructura / Redes', title: 'Notas Infraestructura / Redes', description: body?.infraNotes },
    { type: 'OPERATIONS_NOTE', area: 'Operaciones', title: 'Notas Operaciones / Monitoreo', description: body?.operationsNotes },
    { type: 'DEPENDENCY', area: 'Release', title: 'Dependencias / restricciones', description: body?.dependencyNotes },
    { type: 'PAP_CONTEXT', area: 'Release', title: 'Notas para Plan PAP / Jira', description: body?.papOperationalNotes },
  ];

  return items
    .map((item) => ({
      rdc_id: rdcId,
      type: item.type,
      area: item.area,
      title: item.title,
      description: clean(item.description),
      created_by: userEmail || 'Portal Release',
    }))
    .filter((item) => item.description);
}

function evidenceRows(rdcId: string, body: any, userEmail?: string | null) {
  return clean(body?.evidenceLinks)
    .split(/\n|,|;/)
    .map((url: string) => url.trim())
    .filter(Boolean)
    .map((url: string) => ({
      rdc_id: rdcId,
      source: 'RDC_FORM',
      title: 'Evidencia / documentación complementaria',
      url,
      evidence_type: 'URL',
      created_by: userEmail || 'Portal Release',
    }));
}

async function insertTraceabilitySafely(supabase: any, rdcId: string, body: any, userEmail?: string | null) {
  const traceRows = traceabilityRows(rdcId, body, userEmail);
  const evidence = evidenceRows(rdcId, body, userEmail);
  const warnings: string[] = [];

  if (traceRows.length) {
    const { error } = await supabase.from('rdc_traceability').insert(traceRows);
    if (error) warnings.push(`rdc_traceability: ${error.message}`);
  }

  if (evidence.length) {
    const { error } = await supabase.from('rdc_evidence').insert(evidence);
    if (error) warnings.push(`rdc_evidence: ${error.message}`);
  }

  return warnings;
}


export async function POST(req: Request) {
  try {
    const { user, deny } = await requireUser();
    if (deny) return deny;

    if (roleOf(user) === 'approver') {
      return NextResponse.json({ ok: false, error: 'El rol aprobador no puede crear RDC' }, { status: 403 });
    }

    const body = await req.json();

    const title = String(body?.title || '').trim();
    if (!title) {
      return NextResponse.json({ ok: false, error: 'El nombre del cambio es obligatorio' }, { status: 400 });
    }

    const supabase = createSupabaseAdmin();

    const { data: rdc, error: rdcError } = await supabase
      .from('rdc')
      .insert({
        title,
        description: String(body?.description || '').trim(),
        category: String(body?.category || '').trim(),
        system: String(body?.system || '').trim(),
        cell: String(body?.cell || '').trim(),
        status: 'PENDIENTE_APROBACIONES',
        // Ahora el creador es el usuario autenticado (antes era un literal).
        created_by: user?.email || body?.createdBy || 'Portal Release',
        presenter: String(body?.presenter || '').trim(),
        technical_lead: String(body?.technicalLead || '').trim(),
        qa_analyst: String(body?.qaAnalyst || '').trim(),
        business_validator: String(body?.businessValidator || '').trim(),
        jira_origin: String(body?.jiraOrigin || '').trim(),
        proposed_deploy_date: body?.proposedDeployDate || null,
        validation_date: body?.validationDate || null,
        deployment_result: String(body?.deploymentResult || 'PENDIENTE').trim(),
      })
      .select('*')
      .single();

    if (rdcError) {
      return NextResponse.json({ ok: false, error: rdcError.message }, { status: 500 });
    }

    const detailPayload = {
      rdc_id: rdc.id,
      requirement_description: String(body?.requirementDescription || '').trim(),
      implemented_solution: String(body?.implementedSolution || '').trim(),
      affected_services: String(body?.affectedServices || '').trim(),
      affected_users: String(body?.affectedUsers || '').trim(),
      consequence_not_implementing: String(body?.consequenceNotImplementing || '').trim(),
      validation_plan: clean(body?.validationPlan),
      deployment_plan: clean(body?.implementationSummary) || clean(body?.deploymentPlan),
      rollback_plan: clean(body?.rollbackPlan),
      impact: String(body?.impact || '').trim(),
      priority: String(body?.priority || '').trim(),
      requires_dba: Boolean(body?.requiresDba),
      requires_networks: Boolean(body?.requiresNetworks),
      requires_infra: Boolean(body?.requiresInfra),
      requires_monitoring: Boolean(body?.requiresMonitoring),
      dependent_rdc: String(body?.dependentRdc || '').trim(),
      form_data: body?.formData && typeof body.formData === 'object' ? body.formData : {},
      form_version: 'rdc_2_0',
    };

    const { data: details, error: detailsError } = await supabase
      .from('rdc_details')
      .insert(detailPayload)
      .select('*')
      .single();

    if (detailsError) {
      await supabase.from('rdc').delete().eq('id', rdc.id);
      return NextResponse.json({ ok: false, error: detailsError.message }, { status: 500 });
    }

    // La información complementaria queda en BD si las tablas existen.
    // Si aún no se ejecutó la migración, no bloquea la creación del RDC porque también queda respaldada en rdc_details.form_data.
    const traceabilityWarnings = await insertTraceabilitySafely(supabase, rdc.id, body, user?.email);

    const selectedApprovalRoles: string[] =
      Array.isArray(body?.selectedApprovalRoles) && body.selectedApprovalRoles.length > 0
        ? body.selectedApprovalRoles
        : DEFAULT_APPROVERS;

    const { data: configuredRoles, error: configuredRolesError } = await supabase
      .from('approval_roles')
      .select('*')
      .in('role_name', selectedApprovalRoles)
      .eq('active', true);

    if (configuredRolesError) {
      await supabase.from('rdc').delete().eq('id', rdc.id);
      return NextResponse.json({ ok: false, error: configuredRolesError.message }, { status: 500 });
    }

    const rolesByName = (configuredRoles || []).reduce((acc: Record<string, any>, role: any) => {
      if (!acc[role.role_name]) {
        acc[role.role_name] = role;
      }
      return acc;
    }, {});

    const approvalRows = selectedApprovalRoles.map((role: string) => {
      const configured = rolesByName[role];
      return {
        rdc_id: rdc.id,
        approver_role: role,
        approver_name: configured?.approver_name || role,
        approver_email: configured?.approver_email || null,
        approver_account_id: configured?.approver_account_id || null,
        status: 'PENDIENTE',
      };
    });

    const { data: approvals, error: approvalsError } = await supabase
      .from('approval_requests')
      .insert(approvalRows)
      .select('*');

    if (approvalsError) {
      await supabase.from('rdc').delete().eq('id', rdc.id);
      return NextResponse.json({ ok: false, error: approvalsError.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, rdc, details, approvals, traceabilityWarnings });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message || 'Error creando RDC' },
      { status: 500 }
    );
  }
}
