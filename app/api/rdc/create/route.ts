import { NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase-admin';
import { requireUser, roleOf } from '@/lib/auth';
import { notifyRdcCreated, notifyApprovalPending } from '@/lib/notifications';
import { PAP_FIELDS, adfText, jiraSelect, normalizeCategory, normalizeSeverity } from '@/lib/jira-pap-field-map';
import {
  JIRA_SISTEMA_OPTIONS,
  JIRA_CATEGORIA_OPTIONS,
  JIRA_CELULA_OPTIONS,
  JIRA_TIPO_CAMBIO_OPTIONS,
  JIRA_PRIORIDAD_OPTIONS,
  JIRA_SEVERIDAD_OPTIONS,
  resolveJiraValue,
} from '@/lib/jira-field-values';

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


// ===== Integración inmediata con Jira PAP =====

function getJiraEnv(name: string): string | null {
  return process.env[name] || null;
}

function buildJiraAuth(): string | null {
  const email = getJiraEnv('JIRA_EMAIL') || getJiraEnv('JIRA_USER');
  const token = getJiraEnv('JIRA_TOKEN') || getJiraEnv('JIRA_API_TOKEN');
  if (!email || !token) return null;
  return `Basic ${Buffer.from(`${email}:${token}`).toString('base64')}`;
}

function buildJiraDescription(rdc: any, body: any) {
  const formData = body?.formData || {};
  const rdcUrl = `${process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || ''}/rdc/${rdc.id}`;

  const lines = [
    'RDC creado automáticamente desde Release Management Portal',
    '',
    `Sistema / Producto: ${body?.system || 'Sin sistema'}`,
    `Célula: ${body?.cell || 'Sin célula'}`,
    `Categoría: ${body?.category || 'Sin categoría'}`,
    `Jira Origen: ${body?.jiraOrigin || 'No informado'}`,
    `Líder Técnico: ${body?.technicalLead || 'No informado'}`,
    `Fecha Propuesta Deploy: ${body?.proposedDeployDate || 'No informada'}`,
    '',
    '--- Descripción del Requerimiento ---',
    body?.requirementDescription || 'Sin descripción',
    '',
    '--- Solución Implementada ---',
    body?.implementedSolution || 'No informada',
    '',
    '--- Servicios Afectados ---',
    body?.affectedServices || 'No informado',
    '',
    '--- Usuarios Afectados ---',
    body?.affectedUsers || 'No informado',
    '',
    '--- Consecuencias si no se aprueba ---',
    body?.consequenceNotImplementing || 'No informado',
    '',
    '--- Plan de Validación ---',
    body?.validationPlan || 'No informado',
    '',
    '--- Clasificación ---',
    `Tipo de Cambio: ${formData?.classification?.changeType || body?.changeType || 'Software'}`,
    `Impacto: ${body?.impact || 'Medio'}`,
    `Prioridad: ${body?.priority || 'Media'}`,
    `Urgencia: ${formData?.classification?.urgency || 'Normal'}`,
    `Negocio Impactado: ${formData?.business?.impactedBusiness || 'No informado'}`,
    `Ambiente: ${formData?.business?.environment || 'Producción'}`,
    '',
    '--- Requisitos Previos ---',
    `Requiere DBA: ${body?.requiresDba ? 'Sí' : 'No'}`,
    `Requiere Redes: ${body?.requiresNetworks ? 'Sí' : 'No'}`,
    `Requiere Infraestructura: ${body?.requiresInfra ? 'Sí' : 'No'}`,
    `Requiere Monitoreo: ${body?.requiresMonitoring ? 'Sí' : 'No'}`,
    '',
    '--- Despliegue ---',
    `Horario: ${formData?.schedule || 'Sin restricción'}`,
    `Asistido: ${formData?.assisted || 'No Aplica'}`,
    `Impacto Corte: ${formData?.cutImpact || 'No aplica'}`,
    `Plan Despliegue QA: ${formData?.deployPlanQa || 'No informado'}`,
    `Plan Despliegue Prod: ${formData?.deployPlanProd || 'No informado'}`,
    `Rollback QA: ${formData?.rollbackQa || 'No informado'}`,
    `Rollback Prod: ${formData?.rollbackProd || 'No informado'}`,
    `Plan Mitigación: ${formData?.mitigationPlan || 'No informado'}`,
    '',
    '--- Sistemas Relacionados ---',
    ...(Array.isArray(formData?.relatedSystems) && formData.relatedSystems.length > 0
      ? formData.relatedSystems.map((s: string) => `• ${s}`)
      : ['No informado']),
    '',
    '--- Componentes PIM ---',
    ...(Array.isArray(formData?.pimComponents) && formData.pimComponents.length > 0
      ? formData.pimComponents.filter((p: any) => p.name).map((p: any) => `• ${p.name} v${p.version} (${p.status})`)
      : ['Sin componentes']),
    '',
    '--- Aprobadores ---',
    ...(Array.isArray(body?.selectedApprovalRoles)
      ? body.selectedApprovalRoles.map((r: string) => `• ${r}`)
      : ['Default']),
    '',
    '--- Links ---',
    rdcUrl.startsWith('http') ? `RDC Portal: ${rdcUrl}` : 'RDC: URL no configurada',
  ];

  return lines.join('\n');
}

function buildJiraMappedFields(body: any) {
  const fields: any = {};
  const system = body?.system;
  const category = body?.category;
  const impact = body?.impact;
  const formData = body?.formData || {};

  // Helper: solo agrega el campo si hay un valor resuelto válido
  function addResolvedSelect(fieldId: string | undefined, fieldKey: string, rdcValue: string | undefined, options: string[]) {
    if (!fieldId || !rdcValue) return;
    const resolved = resolveJiraValue(fieldKey, rdcValue, options);
    if (resolved) fields[fieldId] = { value: resolved };
  }

  // === Campos SELECT con resolución inteligente ===
  addResolvedSelect(PAP_FIELDS.sistemaProducto, 'sistema', system, JIRA_SISTEMA_OPTIONS);
  addResolvedSelect(PAP_FIELDS.categoriaCambio, 'categoria', normalizeCategory(category), JIRA_CATEGORIA_OPTIONS);
  addResolvedSelect(PAP_FIELDS.celula, 'celula', body?.cell, JIRA_CELULA_OPTIONS);
  addResolvedSelect(PAP_FIELDS.tipoCambio, 'tipoCambio', formData?.classification?.changeType, JIRA_TIPO_CAMBIO_OPTIONS);
  addResolvedSelect(PAP_FIELDS.prioridad, 'prioridad', body?.priority, JIRA_PRIORIDAD_OPTIONS);
  addResolvedSelect(PAP_FIELDS.gradoSeveridad, 'severidad', normalizeSeverity(impact), JIRA_SEVERIDAD_OPTIONS);

  // === Campos DATE ===
  if (PAP_FIELDS.fechaDeploy && body?.proposedDeployDate) {
    fields[PAP_FIELDS.fechaDeploy] = body.proposedDeployDate; // formato yyyy-MM-dd
  }
  if (PAP_FIELDS.fechaInicio && body?.proposedDeployDate) {
    fields[PAP_FIELDS.fechaInicio] = new Date().toISOString().slice(0, 10);
  }

  // === Campos TEXTAREA (ADF) ===
  if (PAP_FIELDS.razonCambio && body?.requirementDescription) {
    fields[PAP_FIELDS.razonCambio] = adfText(body.requirementDescription);
  }
  if (PAP_FIELDS.solucionRequerimiento && body?.implementedSolution) {
    fields[PAP_FIELDS.solucionRequerimiento] = adfText(body.implementedSolution);
  }
  if (PAP_FIELDS.consecuencias && body?.consequenceNotImplementing) {
    fields[PAP_FIELDS.consecuencias] = adfText(body.consequenceNotImplementing);
  }
  if (PAP_FIELDS.planValidacion && body?.validationPlan) {
    fields[PAP_FIELDS.planValidacion] = adfText(body.validationPlan);
  }
  if (PAP_FIELDS.planDespliegue && formData?.deployPlanProd) {
    fields[PAP_FIELDS.planDespliegue] = adfText(formData.deployPlanProd);
  }
  if (PAP_FIELDS.planRemediacion && formData?.rollbackProd) {
    fields[PAP_FIELDS.planRemediacion] = adfText(formData.rollbackProd);
  }

  // Listado de componentes PIM
  if (PAP_FIELDS.listadoComponentes && Array.isArray(formData?.pimComponents)) {
    const comps = formData.pimComponents
      .filter((p: any) => p.name)
      .map((p: any) => `${p.name} v${p.version} (${p.status})`)
      .join('\n');
    if (comps) fields[PAP_FIELDS.listadoComponentes] = adfText(comps);
  }

  // RDC link
  const rdcUrl = `${process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || ''}/rdc/${body?._rdcId || ''}`;
  if (PAP_FIELDS.adjuntarRdcDeployment && rdcUrl.startsWith('http')) {
    fields[PAP_FIELDS.adjuntarRdcDeployment] = adfText(`RDC digital Klap DORA:\n${rdcUrl}`);
  }

  // Calendario de cambios URL
  if (PAP_FIELDS.calendarioCambios && process.env.JIRA_CALENDARIO_CAMBIOS_URL) {
    fields[PAP_FIELDS.calendarioCambios] = process.env.JIRA_CALENDARIO_CAMBIOS_URL;
  }

  return fields;
}

/**
 * Crea el issue en Jira PAP inmediatamente al registrar el RDC.
 * Si falla (env no configurado, Jira caído, campo inválido), no bloquea la creación del RDC.
 */
async function createJiraPapImmediate(rdc: any, body: any): Promise<{ jiraKey?: string; jiraError?: string }> {
  try {
    const auth = buildJiraAuth();
    const base = (getJiraEnv('JIRA_BASE') || getJiraEnv('JIRA_BASE_URL') || '').replace(/\/$/, '');

    if (!auth || !base) {
      return { jiraError: 'Jira no configurado (JIRA_EMAIL/JIRA_TOKEN/JIRA_BASE)' };
    }

    const projectKey = getJiraEnv('JIRA_PROJECT_KEY') || getJiraEnv('JIRA_PROJECT') || 'PAP';
    const issueType = getJiraEnv('JIRA_ISSUE_TYPE') || 'Tarea';

    const descriptionText = buildJiraDescription(rdc, body);
    const shouldMap = getJiraEnv('JIRA_ENABLE_PAP_FIELD_MAPPING') !== 'false';
    const mappedFields = shouldMap ? buildJiraMappedFields({ ...body, _rdcId: rdc.id }) : {};

    const baseFields: any = {
      project: { key: projectKey },
      summary: rdc.title,
      description: adfText(descriptionText),
      issuetype: { name: issueType },
    };

    // Primer intento con custom fields
    let response = await fetch(`${base}/rest/api/3/issue`, {
      method: 'POST',
      headers: { Authorization: auth, Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields: { ...baseFields, ...mappedFields } }),
    });

    let data = await response.json().catch(() => null);
    let firstAttemptError: any = null;
    let createdWithFallback = false;

    // Si falla por campos custom, reintentar solo con base
    if (!response.ok && Object.keys(mappedFields).length > 0 && response.status >= 400 && response.status < 500) {
      firstAttemptError = { status: response.status, errors: data?.errors, errorMessages: data?.errorMessages };
      response = await fetch(`${base}/rest/api/3/issue`, {
        method: 'POST',
        headers: { Authorization: auth, Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields: baseFields }),
      });
      data = await response.json().catch(() => null);
      createdWithFallback = true;
    }

    if (!response.ok) {
      return { jiraError: `Jira ${response.status}: ${JSON.stringify(data?.errors || data?.errorMessages || 'Error desconocido')}` };
    }

    return { jiraKey: data?.key, firstAttemptError, createdWithFallback, mappedFieldKeys: Object.keys(mappedFields) };
  } catch (err: any) {
    return { jiraError: err?.message || 'Error conectando con Jira' };
  }
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

    // === Crear issue en Jira PAP inmediatamente ===
    let jiraKey: string | undefined;
    let jiraError: string | undefined;

    const jiraResult = await createJiraPapImmediate(rdc, body);
    jiraKey = jiraResult.jiraKey;
    jiraError = jiraResult.jiraError;

    // Diagnósticos de Jira para troubleshooting
    const jiraDiagnostics = {
      firstAttemptError: (jiraResult as any).firstAttemptError || null,
      createdWithFallback: (jiraResult as any).createdWithFallback || false,
      mappedFieldKeys: (jiraResult as any).mappedFieldKeys || [],
    };

    // Si se creó exitosamente, guardar la jira_key en el RDC
    if (jiraKey) {
      await supabase
        .from('rdc')
        .update({ jira_key: jiraKey, jira_created_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('id', rdc.id);
    }

    // === Notificaciones por email (no bloquean la respuesta) ===
    const notifyPromises: Promise<any>[] = [];

    // Notificar al creador
    if (user?.email) {
      notifyPromises.push(
        notifyRdcCreated({
          rdcTitle: rdc.title,
          rdcId: rdc.id,
          creatorEmail: user.email,
          creatorName: rdc.presenter || user.email.split('@')[0],
          system: rdc.system || '',
          category: rdc.category || '',
        })
      );
    }

    // Notificar a cada aprobador
    for (const approval of (approvals || [])) {
      if (approval.approver_email) {
        notifyPromises.push(
          notifyApprovalPending({
            rdcTitle: rdc.title,
            rdcId: rdc.id,
            approverEmail: approval.approver_email,
            approverName: approval.approver_name || approval.approver_role,
            approverRole: approval.approver_role,
            approvalToken: approval.approval_token || approval.id,
          })
        );
      }
    }

    // Ejecutar en background sin bloquear respuesta
    Promise.allSettled(notifyPromises).catch(() => {});

    return NextResponse.json({
      ok: true,
      rdc: { ...rdc, jira_key: jiraKey },
      details,
      approvals,
      traceabilityWarnings,
      jiraKey: jiraKey || null,
      jiraError: jiraError || null,
      jiraDiagnostics,
    });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message || 'Error creando RDC' },
      { status: 500 }
    );
  }
}
