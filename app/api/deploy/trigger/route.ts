import { NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase-admin';
import { requireActionPermission } from '@/lib/auth';

export const dynamic = 'force-dynamic';

function basicAuth(user: string, token: string) {
  return Buffer.from(`${user}:${token}`).toString('base64');
}

function stripHtml(value: string) {
  return String(value || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

function friendlyJenkinsError(status: number, body: string) {
  const clean = stripHtml(body);
  const lower = clean.toLowerCase();

  if (lower.includes('oops') || lower.includes('a problem occurred while processing the request')) {
    return `Jenkins respondió ${status}: ocurrió un error interno al procesar la ejecución. Revisa el Log ID en Jenkins y valida si el job acepta parámetros o debe ejecutarse sin parámetros. Detalle: ${clean.slice(0, 500)}`;
  }

  if (lower.includes('no valid crumb') || lower.includes('crumb')) {
    return 'Jenkins rechazó la ejecución por CSRF/Crumb. Revisa configuración CSRF o permisos del usuario/token.';
  }

  if (lower.includes('authentication') || lower.includes('unauthorized') || status === 401) {
    return 'Jenkins rechazó la autenticación. Revisa JENKINS_USER y JENKINS_API_TOKEN en Vercel.';
  }

  if (status === 403) {
    return 'Jenkins rechazó la ejecución por permisos. El usuario configurado necesita permisos Job/Build sobre este pipeline.';
  }

  if (status === 404) {
    return 'Jenkins no encontró el job indicado. Revisa que el nombre del job sea exacto.';
  }

  if (clean) {
    return `Jenkins respondió ${status}: ${clean.slice(0, 700)}`;
  }

  return `Jenkins respondió ${status} sin detalle.`;
}

function buildJobPath(baseUrl: string, jobName: string) {
  const cleanBaseUrl = baseUrl.replace(/\/$/, '');
  const cleanJob = jobName.replace(/\s+·\s+.*$/, '').replace(/\s+-\s+OK$/, '').trim();

  if (cleanJob.includes('/job/')) {
    const raw = cleanJob.startsWith('http') ? cleanJob : `${cleanBaseUrl}/${cleanJob.replace(/^\//, '')}`;
    return raw.replace(/\/$/, '');
  }

  if (cleanJob.includes('/')) {
    const encoded = cleanJob.split('/').map(encodeURIComponent).join('/job/');
    return `${cleanBaseUrl}/job/${encoded}`;
  }

  return `${cleanBaseUrl}/job/${encodeURIComponent(cleanJob)}`;
}

async function getJenkinsCrumb(baseUrl: string, authHeader: string) {
  try {
    const response = await fetch(`${baseUrl.replace(/\/$/, '')}/crumbIssuer/api/json`, {
      method: 'GET',
      headers: {
        Authorization: authHeader,
        Accept: 'application/json',
      },
      cache: 'no-store',
    });

    if (!response.ok) return null;

    const data = await response.json();
    const field = String(data?.crumbRequestField || 'Jenkins-Crumb');
    const crumb = String(data?.crumb || '');

    if (!crumb) return null;

    return { field, crumb };
  } catch {
    return null;
  }
}

async function getJobInfo(jobUrl: string, authHeader: string) {
  try {
    const response = await fetch(`${jobUrl}/api/json?tree=name,url,property[parameterDefinitions[name,type,defaultParameterValue[value]]]`, {
      method: 'GET',
      headers: {
        Authorization: authHeader,
        Accept: 'application/json',
      },
      cache: 'no-store',
    });

    if (!response.ok) return { ok: false, hasParameters: true, raw: null };

    const data = await response.json();
    const properties = Array.isArray(data?.property) ? data.property : [];
    const params = properties.flatMap((p: any) => Array.isArray(p?.parameterDefinitions) ? p.parameterDefinitions : []);

    return {
      ok: true,
      hasParameters: params.length > 0,
      parameters: params.map((p: any) => String(p?.name || '')).filter(Boolean),
      raw: data,
    };
  } catch {
    return { ok: false, hasParameters: true, raw: null };
  }
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

  const cleanBaseUrl = baseUrl.replace(/\/$/, '');
  const authHeader = `Basic ${basicAuth(user, token)}`;
  const crumb = await getJenkinsCrumb(cleanBaseUrl, authHeader);
  const jobUrl = buildJobPath(cleanBaseUrl, jobName);
  const jobInfo = await getJobInfo(jobUrl, authHeader);

  const useParameters = jobInfo.hasParameters;
  const triggerUrl = useParameters ? `${jobUrl}/buildWithParameters` : `${jobUrl}/build`;

  const headers: Record<string, string> = {
    Authorization: authHeader,
    Accept: 'application/json,text/plain,*/*',
  };

  if (crumb) {
    headers[crumb.field] = crumb.crumb;
  }

  let body: URLSearchParams | undefined = undefined;

  if (useParameters) {
    body = new URLSearchParams();
    const acceptedParams = Array.isArray((jobInfo as any).parameters) ? (jobInfo as any).parameters : [];

    Object.entries(parameters).forEach(([key, value]) => {
      if (acceptedParams.length === 0 || acceptedParams.includes(key)) {
        body!.set(key, value || '');
      }
    });

    headers['Content-Type'] = 'application/x-www-form-urlencoded';
  }

  const response = await fetch(triggerUrl, {
    method: 'POST',
    headers,
    body,
    cache: 'no-store',
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(friendlyJenkinsError(response.status, text));
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
      crumbUsed: Boolean(crumb),
      crumbField: crumb?.field || null,
      jobUrl,
      triggerUrl,
      usedEndpoint: useParameters ? 'buildWithParameters' : 'build',
      jobAcceptsParameters: useParameters,
      acceptedParameters: (jobInfo as any).parameters || [],
    },
  };
}

export async function POST(req: Request) {
  const { user, deny } = await requireActionPermission('execute_jenkins');
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
    const cleanError = error?.message || 'No se pudo ejecutar Jenkins';

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
        raw_response: { error: cleanError },
      });

    return NextResponse.json({ ok: false, error: cleanError }, { status: 500 });
  }
}
