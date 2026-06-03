import { NextResponse } from 'next/server';
import { createSupabaseAdmin } from '../../../../lib/supabase-admin';
import { requireRM } from '../../../../lib/auth';

export const dynamic = 'force-dynamic';

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

// La categoría del RDC se setea por VALUE (no por id de opción), y se normaliza
// para que calce EXACTO con las opciones reales del campo "Categoría de Cambio"
// (customfield_12321): Mantencion / Proyecto / Incidente / Hotfix / ECAB / Recurrente.
const CATEGORY_VALUE_MAP: Record<string, string> = {
  'Mantención': 'Mantencion',
  'Mantencion': 'Mantencion',
  'Proyecto': 'Proyecto',
  'Incidente': 'Incidente',
  'Hotfix': 'Hotfix',
  'ECAB': 'ECAB',
  'Recurrente': 'Recurrente',
};

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
      .select('*, approval_requests(*)')
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

    const base = getEnv('JIRA_BASE').replace(/\/$/, '');
    const projectKey = process.env.JIRA_PROJECT_KEY || process.env.JIRA_PROJECT || 'PAP';
    // PAP (company-managed en español) usa el tipo "Tarea". Override con JIRA_ISSUE_TYPE.
    const issueType = process.env.JIRA_ISSUE_TYPE || 'Tarea';

    const descriptionLines = [
      `RDC generado desde Release Management Portal`,
      ``,
      `Título: ${rdc.title}`,
      `Sistema / Producto: ${rdc.system || 'Sin sistema'}`,
      `Célula: ${rdc.cell || 'Sin célula'}`,
      `Categoría: ${rdc.category || 'Sin categoría'}`,
      ``,
      `Descripción:`,
      rdc.description || 'Sin descripción',
      ``,
      `Aprobaciones:`,
      ...((rdc.approval_requests || []).map((a: any) => `- ${a.approver_role}: ${a.status}${a.comment ? ` (${a.comment})` : ''}`)),
    ];

    const jiraPayload: any = {
      fields: {
        project: { key: projectKey },
        summary: rdc.title,
        description: {
          type: 'doc',
          version: 1,
          content: [
            {
              type: 'paragraph',
              content: [{ type: 'text', text: descriptionLines.join('\n') }],
            },
          ],
        },
        issuetype: { name: issueType },
      },
    };

    // Campos personalizados (se cargan solo si la env existe, para no romper el alta).
    const cfSistema = process.env.CF_SISTEMA;
    const cfTipo = process.env.CF_TIPO;       // Categoría de Cambio (customfield_12321)
    const cfFinicio = process.env.CF_FINICIO; // Fecha Inicio (customfield_10177) → base del lead time

    if (cfSistema && rdc.system) {
      jiraPayload.fields[cfSistema] = { value: rdc.system };
    }

    if (cfTipo && rdc.category) {
      const raw = String(rdc.category).trim();
      const value = CATEGORY_VALUE_MAP[raw] || raw;
      // Select de Jira: se setea por value, no por id.
      jiraPayload.fields[cfTipo] = { value };
    }

    // Fecha Inicio: usamos la fecha de creación del RDC como punto de partida del lead time.
    // (Fecha Deploy y Resultado Deploy NO se setean acá: son post-deploy, los llena el cierre RM.)
    if (cfFinicio && rdc.created_at) {
      jiraPayload.fields[cfFinicio] = String(rdc.created_at).slice(0, 10);
    }

    const jiraResponse = await fetch(`${base}/rest/api/3/issue`, {
      method: 'POST',
      headers: {
        Authorization: buildAuthHeader(),
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(jiraPayload),
    });

    const jiraData = await jiraResponse.json().catch(() => null);

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

    return NextResponse.json({ ok: true, jiraKey, jiraIssue: jiraData });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message || 'Error creando PAP Jira' },
      { status: 500 }
    );
  }
}
