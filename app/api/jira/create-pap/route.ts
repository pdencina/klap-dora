import { NextResponse } from 'next/server';
import { createSupabaseAdmin } from '../../../../lib/supabase-admin';
import { requireRM } from '../../../../lib/auth';
import {
  PAP_FIELDS,
  adfText,
  jiraSelect,
  normalizeCategory,
  normalizeSeverity,
} from '../../../../lib/jira-pap-field-map';

export const dynamic = 'force-dynamic';

type RdcDetails = {
  requirement_description?: string | null;
  implemented_solution?: string | null;
  affected_services?: string | null;
  affected_users?: string | null;
  consequence_not_implementing?: string | null;
  validation_plan?: string | null;
  deployment_plan?: string | null;
  rollback_plan?: string | null;
  impact?: string | null;
  priority?: string | null;
  form_data?: any;
};

function getEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing env ${name}`);
  return value;
}

function buildAuthHeader() {
  const email = getEnv('JIRA_EMAIL');
  const token = getEnv('JIRA_TOKEN');
  return `Basic ${Buffer.from(`${email}:${token}`).toString('base64')}`;
}

function firstDetail(rdc: any): RdcDetails {
  if (Array.isArray(rdc?.rdc_details)) return rdc.rdc_details[0] || {};
  return rdc?.rdc_details || {};
}

function getFormValue(formData: any, path: string, fallback = ''): string {
  const value = path.split('.').reduce((acc, key) => (acc && acc[key] !== undefined ? acc[key] : undefined), formData || {});
  return String(value ?? fallback ?? '').trim();
}

function clean(value?: string | null) {
  return String(value || '').trim();
}

function traceValue(formData: any, key: string) {
  return clean(formData?.traceability?.[key]);
}

function buildTraceabilityText(formData: any) {
  const rows = [
    ['QA', traceValue(formData, 'qaNotes')],
    ['DBA', traceValue(formData, 'dbaNotes')],
    ['Seguridad', traceValue(formData, 'securityNotes')],
    ['Infraestructura / Redes', traceValue(formData, 'infraNotes')],
    ['Operaciones / Monitoreo', traceValue(formData, 'operationsNotes')],
    ['Dependencias / restricciones', traceValue(formData, 'dependencyNotes')],
    ['Evidencias / documentación', traceValue(formData, 'evidenceLinks')],
  ].filter(([, value]) => value);

  if (!rows.length) return 'No se registró trazabilidad complementaria.';
  return rows.map(([area, value]) => `${area}:\n${value}`).join('\n\n');
}

function buildDescriptionText(rdc: any, details: RdcDetails) {
  const formData = details.form_data || {};
  const deploymentPlan = clean(details.deployment_plan) || getFormValue(formData, 'deployment.productionPlan');
  const rollbackPlan = clean(details.rollback_plan) || getFormValue(formData, 'deployment.rollback');
  const mitigationPlan = getFormValue(formData, 'deployment.mitigationPlanCab20');
  const validationPlan = clean(details.validation_plan) || getFormValue(formData, 'deployment.qaPlan');
  const consequences = clean(details.consequence_not_implementing);
  const successCriteria = getFormValue(formData, 'rdcCore.successCriteria');
  const papOperationalNotes = getFormValue(formData, 'planning.papOperationalNotes');
  const traceabilityText = buildTraceabilityText(formData);
  const rdcUrl = `${process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || ''}/rdc/${rdc.id}`;
  const papUrl = `${process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || ''}/pap?rdcId=${rdc.id}`;

  return [
    'RDC generado desde Release Management Portal',
    '',
    `Título: ${rdc.title}`,
    `Sistema / Producto: ${rdc.system || 'Sin sistema'}`,
    `Célula: ${rdc.cell || 'Sin célula'}`,
    `Categoría: ${rdc.category || 'Sin categoría'}`,
    `Jira Origen: ${rdc.jira_origin || 'No informado'}`,
    `RFC: ${rdc.rfc || 'No aplica'}`,
    `Fecha Deploy: ${rdc.proposed_deploy_date || 'No informada'}`,
    '',
    'Descripción del requerimiento:',
    clean(details.requirement_description) || rdc.description || 'Sin descripción',
    '',
    'Solución del requerimiento:',
    clean(details.implemented_solution) || 'No informado',
    '',
    'Servicios / usuarios afectados:',
    `Servicios: ${clean(details.affected_services) || 'No informado'}`,
    `Usuarios: ${clean(details.affected_users) || 'No informado'}`,
    '',
    'Consecuencias si no se aprueba o se pospone:',
    consequences || 'No informado',
    '',
    'Plan de validación:',
    validationPlan || 'No informado',
    '',
    'Plan de despliegue producción:',
    deploymentPlan || 'No informado',
    '',
    'Rollback / Mitigación:',
    rollbackPlan || mitigationPlan || 'No informado',
    '',
    'Criterios de éxito:',
    successCriteria || 'No informado',
    '',
    'Notas para Plan PAP / ejecución:',
    papOperationalNotes || 'No informado',
    '',
    'Trazabilidad complementaria por área:',
    traceabilityText,
    '',
    'Links Release Portal:',
    rdcUrl.startsWith('http') ? `RDC: ${rdcUrl}` : 'RDC: URL no configurada',
    papUrl.startsWith('http') ? `Plan PAP: ${papUrl}` : 'Plan PAP: URL no configurada',
    '',
    'Aprobaciones CAB:',
    ...((rdc.approval_requests || []).map((a: any) => `- ${a.approver_role}: ${a.status}${a.comment ? ` (${a.comment})` : ''}`)),
  ].join('\n');
}

function addAdfField(fields: any, fieldId: string | undefined, value?: string | null) {
  const text = clean(value);
  if (fieldId && text) fields[fieldId] = adfText(text);
}

function addSelectField(fields: any, fieldId: string | undefined, value?: string | null) {
  const select = jiraSelect(value);
  if (fieldId && select) fields[fieldId] = select;
}

function buildMappedFields(rdc: any, details: RdcDetails) {
  const formData = details.form_data || {};
  const fields: any = {};

  addSelectField(fields, PAP_FIELDS.sistemaProducto, rdc.system);
  addSelectField(fields, PAP_FIELDS.categoriaCambio, normalizeCategory(rdc.category));
  addSelectField(fields, PAP_FIELDS.gradoSeveridad, normalizeSeverity(details.impact || details.priority));

  addAdfField(fields, PAP_FIELDS.razonCambio, details.requirement_description || rdc.description);
  addAdfField(fields, PAP_FIELDS.solucionRequerimiento, details.implemented_solution);
  addAdfField(fields, PAP_FIELDS.consecuencias, details.consequence_not_implementing);
  addAdfField(fields, PAP_FIELDS.planValidacion, details.validation_plan || getFormValue(formData, 'deployment.qaPlan'));
  addAdfField(fields, PAP_FIELDS.planDespliegue, details.deployment_plan || getFormValue(formData, 'deployment.productionPlan'));

  const rdcUrl = `${process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || ''}/rdc/${rdc.id}`;
  if (PAP_FIELDS.adjuntarRdcDeployment && rdcUrl.startsWith('http')) {
    fields[PAP_FIELDS.adjuntarRdcDeployment] = adfText(`RDC digital Klap DORA:\n${rdcUrl}`);
  }

  if (PAP_FIELDS.calendarioCambios && process.env.JIRA_CALENDARIO_CAMBIOS_URL) {
    fields[PAP_FIELDS.calendarioCambios] = process.env.JIRA_CALENDARIO_CAMBIOS_URL;
  }

  return fields;
}

async function createJiraIssue(base: string, payload: any) {
  const jiraResponse = await fetch(`${base}/rest/api/3/issue`, {
    method: 'POST',
    headers: {
      Authorization: buildAuthHeader(),
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const jiraData = await jiraResponse.json().catch(() => null);
  return { jiraResponse, jiraData };
}

export async function POST(req: Request) {
  try {
    const { deny } = await requireRM();
    if (deny) return deny;

    const body = await req.json();
    const rdcId = String(body?.rdcId || '').trim();

    if (!rdcId) {
      return NextResponse.json({ ok: false, error: 'rdcId requerido' }, { status: 400 });
    }

    const supabase = createSupabaseAdmin();

    const { data: rdc, error: rdcError } = await supabase
      .from('rdc')
      .select('*, rdc_details(*), approval_requests(*)')
      .eq('id', rdcId)
      .single();

    if (rdcError || !rdc) {
      return NextResponse.json({ ok: false, error: rdcError?.message || 'RDC no encontrado' }, { status: 404 });
    }

    if (rdc.jira_key) {
      return NextResponse.json({ ok: true, jiraKey: rdc.jira_key, alreadyCreated: true });
    }

    if (rdc.status !== 'APROBADO_PARA_EJECUCION') {
      return NextResponse.json(
        { ok: false, error: 'El RDC debe estar APROBADO_PARA_EJECUCION antes de crear PAP Jira' },
        { status: 400 }
      );
    }

    const details = firstDetail(rdc);
    const base = getEnv('JIRA_BASE').replace(/\/$/, '');
    const projectKey = process.env.JIRA_PROJECT_KEY || process.env.JIRA_PROJECT || 'PAP';
    const issueType = process.env.JIRA_ISSUE_TYPE || 'Tarea';
    const descriptionText = buildDescriptionText(rdc, details);

    const baseFields: any = {
      project: { key: projectKey },
      summary: rdc.title,
      description: adfText(descriptionText),
      issuetype: { name: issueType },
    };

    const shouldMapCustomFields = process.env.JIRA_ENABLE_PAP_FIELD_MAPPING !== 'false';
    const mappedFields = shouldMapCustomFields ? buildMappedFields(rdc, details) : {};

    const jiraPayload: any = {
      fields: {
        ...baseFields,
        ...mappedFields,
      },
    };

    let { jiraResponse, jiraData } = await createJiraIssue(base, jiraPayload);
    let createdWithFallback = false;

    // Si Jira rechaza un custom field por contexto, pantalla o valor de select,
    // no bloqueamos el proceso CAB/PAP: reintentamos con payload base.
    if (!jiraResponse.ok && Object.keys(mappedFields).length > 0 && jiraResponse.status >= 400 && jiraResponse.status < 500) {
      const retryPayload = { fields: baseFields };
      const retry = await createJiraIssue(base, retryPayload);
      jiraResponse = retry.jiraResponse;
      jiraData = retry.jiraData;
      createdWithFallback = true;
    }

    if (!jiraResponse.ok) {
      return NextResponse.json(
        { ok: false, error: `Jira create issue error ${jiraResponse.status}`, details: jiraData },
        { status: jiraResponse.status }
      );
    }

    const jiraKey = jiraData?.key;

    const { error: updateError } = await supabase
      .from('rdc')
      .update({
        jira_key: jiraKey,
        jira_created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', rdcId);

    if (updateError) {
      return NextResponse.json({ ok: false, error: updateError.message, jiraKey }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      jiraKey,
      jiraIssue: jiraData,
      mappedFields: Object.keys(mappedFields),
      createdWithFallback,
    });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message || 'Error creando PAP Jira' },
      { status: 500 }
    );
  }
}
