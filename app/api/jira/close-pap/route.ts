import { NextResponse } from 'next/server';
import { createSupabaseAdmin } from '../../../../lib/supabase-admin';
import { requireRM } from '../../../../lib/auth';

export const dynamic = 'force-dynamic';

function getEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing env ${name}`);
  return value;
}

function authHeader() {
  return `Basic ${Buffer.from(`${getEnv('JIRA_EMAIL')}:${getEnv('JIRA_TOKEN')}`).toString('base64')}`;
}

// Opciones reales del campo "Resultado Deploy" (customfield_12320) en Jira.
const RESULT_VALUES = new Set([
  'Exitoso',
  'Completado con errores',
  'Rollback',
  'Fallido',
  'Cancelado',
  'Rechazado',
]);

export async function POST(req: Request) {
  try {
    const { deny } = await requireRM();
    if (deny) return deny;

    const body = await req.json();
    const rdcId = String(body?.rdcId || '').trim();
    const deployDate = String(body?.deployDate || '').trim(); // yyyy-MM-dd
    const result = String(body?.result || '').trim();
    const note = String(body?.note || '').trim();

    if (!rdcId) return NextResponse.json({ ok: false, error: 'rdcId requerido' }, { status: 400 });
    if (!deployDate) return NextResponse.json({ ok: false, error: 'Fecha de deploy requerida' }, { status: 400 });
    if (!RESULT_VALUES.has(result)) return NextResponse.json({ ok: false, error: 'Resultado inválido' }, { status: 400 });

    const supabase = createSupabaseAdmin();

    const { data: rdc, error: rdcError } = await supabase.from('rdc').select('*').eq('id', rdcId).single();
    if (rdcError || !rdc) {
      return NextResponse.json({ ok: false, error: rdcError?.message || 'RDC no encontrado' }, { status: 404 });
    }
    if (!rdc.jira_key) {
      return NextResponse.json({ ok: false, error: 'El RDC no tiene PAP creado en Jira' }, { status: 400 });
    }

    const base = getEnv('JIRA_BASE').replace(/\/$/, '');
    const cfDeploy = process.env.CF_FDEPLOY;     // customfield_12319 (Fecha Deploy)
    const cfResultado = process.env.CF_RESULTADO; // customfield_12320 (Resultado Deploy)

    // 1) Actualiza los campos del PAP en Jira (esto es lo que hace que DORA lo cuente).
    const fields: any = {};
    if (cfDeploy) fields[cfDeploy] = deployDate;             // campo date: 'yyyy-MM-dd'
    if (cfResultado) fields[cfResultado] = { value: result }; // select: por value

    if (Object.keys(fields).length > 0) {
      const upd = await fetch(`${base}/rest/api/3/issue/${rdc.jira_key}`, {
        method: 'PUT',
        headers: { Authorization: authHeader(), Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields }),
      });
      if (!upd.ok) {
        const details = await upd.json().catch(() => null);
        return NextResponse.json(
          { ok: false, error: `Jira update error ${upd.status}`, details },
          { status: upd.status },
        );
      }
    }

    // 2) Comentario de cierre opcional.
    if (note) {
      await fetch(`${base}/rest/api/3/issue/${rdc.jira_key}/comment`, {
        method: 'POST',
        headers: { Authorization: authHeader(), Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({
          body: {
            type: 'doc',
            version: 1,
            content: [{ type: 'paragraph', content: [{ type: 'text', text: `Cierre de cambio (${result}): ${note}` }] }],
          },
        }),
      }).catch(() => null);
    }

    // 3) Actualiza el RDC en Supabase.
    const { error: updError } = await supabase
      .from('rdc')
      .update({ deployment_result: result, updated_at: new Date().toISOString() })
      .eq('id', rdcId);

    if (updError) {
      return NextResponse.json({ ok: false, error: updError.message, jiraKey: rdc.jira_key }, { status: 500 });
    }

    return NextResponse.json({ ok: true, jiraKey: rdc.jira_key, result, deployDate });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message || 'Error cerrando el cambio' }, { status: 500 });
  }
}
