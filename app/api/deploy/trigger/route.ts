import { NextResponse } from 'next/server';
import { createSupabaseAdmin } from '../../../../lib/supabase-admin';
import { requireRM } from '../../../../lib/auth';

export const dynamic = 'force-dynamic';

function basicAuth(user: string, token: string) {
  return Buffer.from(`${user}:${token}`).toString('base64');
}

async function triggerJenkins(jobName: string, parameters: Record<string, string>) {
  const baseUrl = process.env.JENKINS_BASE_URL;
  const user = process.env.JENKINS_USER;
  const token = process.env.JENKINS_API_TOKEN;

  if (!baseUrl || !user || !token) {
    return {
      mode: 'mock',
      buildNumber: `mock-${Date.now()}`,
      buildUrl: '',
      queueUrl: '',
      raw: { message: 'Jenkins no configurado. Se registró ejecución simulada.' },
    };
  }

  const encodedJob = jobName.split('/').map(encodeURIComponent).join('/job/');
  const url = `${baseUrl.replace(/\/$/, '')}/job/${encodedJob}/buildWithParameters`;

  const body = new URLSearchParams();
  Object.entries(parameters).forEach(([key, value]) => body.set(key, value));

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basicAuth(user, token)}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Jenkins respondió ${response.status}: ${text.slice(0, 500)}`);
  }

  const queueUrl = response.headers.get('location') || '';

  return {
    mode: 'jenkins',
    buildNumber: '',
    buildUrl: '',
    queueUrl,
    raw: {
      status: response.status,
      queueUrl,
    },
  };
}

export async function POST(req: Request) {
  const { user, deny } = await requireRM();
  if (deny) return deny;

  const body = await req.json();
  const rdcId = String(body?.rdcId || '').trim();
  const jobName = String(body?.jobName || '').trim();
  const version = String(body?.version || '').trim();
  const branchOrTag = String(body?.branchOrTag || '').trim();
  const environment = String(body?.environment || 'Producción').trim();

  if (!rdcId) return NextResponse.json({ ok: false, error: 'Falta rdcId' }, { status: 400 });
  if (!jobName) return NextResponse.json({ ok: false, error: 'Falta jobName' }, { status: 400 });

  const supabase = createSupabaseAdmin();

  const { data: rdc, error: rdcError } = await supabase
    .from('rdc')
    .select('*')
    .eq('id', rdcId)
    .single();

  if (rdcError || !rdc) {
    return NextResponse.json({ ok: false, error: rdcError?.message || 'RDC no encontrado' }, { status: 404 });
  }

  if (!['APROBADO_PARA_EJECUCION', 'PAP_CREADO', 'EN_IMPLEMENTACION'].includes(rdc.status)) {
    return NextResponse.json({ ok: false, error: 'Solo se puede ejecutar deploy para RDC aprobados o en Plan PAP.' }, { status: 409 });
  }

  const parameters = {
    RDC_ID: rdcId,
    RDC_TITLE: rdc.title || '',
    JIRA_KEY: rdc.jira_key || '',
    JIRA_ORIGIN: rdc.jira_origin || '',
    ENVIRONMENT: environment,
    VERSION: version,
    BRANCH_OR_TAG: branchOrTag,
    REQUESTED_BY: user?.email || '',
  };

  try {
    const jenkins = await triggerJenkins(jobName, parameters);

    const { data: run, error: insertError } = await supabase
      .from('deployment_runs')
      .insert({
        rdc_id: rdcId,
        provider: jenkins.mode === 'jenkins' ? 'jenkins' : 'mock',
        job_name: jobName,
        build_number: jenkins.buildNumber,
        build_url: jenkins.buildUrl,
        queue_url: jenkins.queueUrl,
        environment,
        version,
        branch_or_tag: branchOrTag,
        status: 'QUEUED',
        result: null,
        triggered_by: user?.email || null,
        parameters,
        raw_response: jenkins.raw,
      })
      .select('*')
      .single();

    if (insertError) {
      return NextResponse.json({ ok: false, error: insertError.message }, { status: 500 });
    }

    await supabase
      .from('rdc')
      .update({ status: 'EN_IMPLEMENTACION', updated_at: new Date().toISOString() })
      .eq('id', rdcId);

    return NextResponse.json({ ok: true, run, jenkins });
  } catch (error: any) {
    await supabase
      .from('deployment_runs')
      .insert({
        rdc_id: rdcId,
        provider: 'jenkins',
        job_name: jobName,
        environment,
        version,
        branch_or_tag: branchOrTag,
        status: 'FAILED_TO_TRIGGER',
        result: 'FAILURE',
        triggered_by: user?.email || null,
        parameters,
        raw_response: { error: error?.message || 'Error desconocido' },
      });

    return NextResponse.json({ ok: false, error: error?.message || 'No se pudo ejecutar Jenkins' }, { status: 500 });
  }
}
