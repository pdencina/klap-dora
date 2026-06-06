import { NextResponse } from 'next/server';
import { createSupabaseAdmin } from '../../../../lib/supabase-admin';
import { requireRM } from '../../../../lib/auth';

export const dynamic = 'force-dynamic';

function basicAuth(user: string, token: string) {
  return Buffer.from(`${user}:${token}`).toString('base64');
}

function getAuthHeader() {
  const user = process.env.JENKINS_USER;
  const token = process.env.JENKINS_API_TOKEN;

  if (!user || !token) {
    throw new Error('Jenkins no está configurado. Faltan JENKINS_USER o JENKINS_API_TOKEN.');
  }

  return `Basic ${basicAuth(user, token)}`;
}

function getJenkinsBaseUrl() {
  const baseUrl = process.env.JENKINS_BASE_URL;
  if (!baseUrl) {
    throw new Error('Jenkins no está configurado. Falta JENKINS_BASE_URL.');
  }
  return baseUrl.replace(/\/$/, '');
}

function normalizeJenkinsUrl(value: string | null | undefined) {
  const baseUrl = getJenkinsBaseUrl();
  const raw = String(value || '').trim();

  if (!raw) return '';

  try {
    const base = new URL(baseUrl);
    const input = new URL(raw, baseUrl);

    input.protocol = base.protocol;
    input.host = base.host;

    return input.toString().replace(/\/$/, '');
  } catch {
    if (raw.startsWith('/')) return `${baseUrl}${raw}`.replace(/\/$/, '');
    return `${baseUrl}/${raw}`.replace(/\/$/, '');
  }
}

function cleanJobName(jobName: string) {
  return String(jobName || '')
    .replace(/\s+·\s+.*$/, '')
    .replace(/\s+-\s+OK$/, '')
    .trim();
}

function buildJobPath(jobName: string) {
  const baseUrl = getJenkinsBaseUrl();
  const cleanJob = cleanJobName(jobName);

  if (cleanJob.includes('/job/')) {
    const raw = cleanJob.startsWith('http') ? cleanJob : `${baseUrl}/${cleanJob.replace(/^\//, '')}`;
    return normalizeJenkinsUrl(raw);
  }

  if (cleanJob.includes('/')) {
    const encoded = cleanJob.split('/').map(encodeURIComponent).join('/job/');
    return `${baseUrl}/job/${encoded}`;
  }

  return `${baseUrl}/job/${encodeURIComponent(cleanJob)}`;
}

function apiUrl(base: string, query: string) {
  const clean = normalizeJenkinsUrl(base);
  if (!clean) return '';
  if (clean.endsWith('/api/json')) return clean;
  return `${clean}/api/json${query ? `?${query}` : ''}`;
}

function getQueueId(queueUrl?: string | null) {
  const match = String(queueUrl || '').match(/\/queue\/item\/(\d+)/);
  return match ? Number(match[1]) : null;
}

function normalizeResult(result: string | null, building: boolean) {
  if (building) return { status: 'RUNNING', result: null };
  if (!result) return { status: 'RUNNING', result: null };

  if (result === 'SUCCESS') return { status: 'SUCCESS', result: 'SUCCESS' };
  if (result === 'FAILURE') return { status: 'FAILURE', result: 'FAILURE' };
  if (result === 'ABORTED') return { status: 'ABORTED', result: 'ABORTED' };
  if (result === 'UNSTABLE') return { status: 'FAILURE', result: 'UNSTABLE' };

  return { status: result, result };
}

async function fetchJenkinsJson(url: string, authHeader: string) {
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: authHeader,
        Accept: 'application/json',
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      const text = await response.text();
      const err: any = new Error(`Jenkins respondió ${response.status} al consultar estado: ${text.slice(0, 500)}`);
      err.status = response.status;
      err.body = text;
      throw err;
    }

    return response.json();
  } catch (error: any) {
    if (error?.status) throw error;
    const message = error?.message || 'fetch failed';
    throw new Error(`No fue posible consultar Jenkins (${url}). Detalle: ${message}`);
  }
}

async function getBuildFromJobFallback(run: any, authHeader: string) {
  const rawJobUrl = run?.raw_response?.jobUrl || '';
  const jobUrl = rawJobUrl ? normalizeJenkinsUrl(rawJobUrl) : buildJobPath(run.job_name);
  const queueId = getQueueId(run.queue_url);

  const buildsApi = apiUrl(
    jobUrl,
    'tree=builds[number,url,queueId,building,result,timestamp,duration]{0,10}'
  );

  const jobData = await fetchJenkinsJson(buildsApi, authHeader);
  const builds = Array.isArray(jobData?.builds) ? jobData.builds : [];

  if (builds.length === 0) {
    return {
      found: false,
      jobUrl,
      queueId,
      jobData,
      message: 'La cola ya no existe y Jenkins no informó builds recientes para este job.',
    };
  }

  const matched = queueId
    ? builds.find((build: any) => Number(build?.queueId) === Number(queueId))
    : null;

  const selected = matched || builds[0];

  return {
    found: true,
    jobUrl,
    queueId,
    matchedByQueueId: Boolean(matched),
    build: selected,
    jobData,
  };
}

function buildUpdateFromBuild(build: any, extraRaw: Record<string, any>) {
  const normalized = normalizeResult(build?.result || null, Boolean(build?.building));

  return {
    status: normalized.status,
    result: normalized.result,
    build_url: normalizeJenkinsUrl(build?.url || ''),
    build_number: build?.number ? String(build.number) : null,
    finished_at: build?.building ? null : new Date().toISOString(),
    raw_response: {
      ...extraRaw,
      build,
      syncMessage: build?.building
        ? 'Build en ejecución.'
        : `Build finalizado con resultado ${build?.result || 'desconocido'}.`,
    },
  };
}

async function syncFromJenkins(run: any) {
  const authHeader = getAuthHeader();

  let queueData: any = null;
  let buildData: any = null;
  let buildUrl = run.build_url ? normalizeJenkinsUrl(run.build_url) : '';
  let buildNumber = run.build_number || null;
  let status = run.status || 'QUEUED';
  let result = run.result || null;

  if (!buildUrl && run.queue_url) {
    const normalizedQueueUrl = normalizeJenkinsUrl(run.queue_url);

    const queueUrl = apiUrl(
      normalizedQueueUrl,
      'tree=cancelled,blocked,buildable,stuck,why,executable[number,url]'
    );

    try {
      queueData = await fetchJenkinsJson(queueUrl, authHeader);
    } catch (error: any) {
      if (error?.status === 404) {
        const fallback = await getBuildFromJobFallback(run, authHeader);

        if (fallback.found) {
          return buildUpdateFromBuild(fallback.build, {
            ...(run.raw_response || {}),
            normalizedQueueUrl,
            queueExpired: true,
            fallback,
            syncMessage: 'La cola expiró en Jenkins. Se obtuvo el estado desde los builds recientes del job.',
          });
        }

        return {
          status: 'QUEUED',
          result: null,
          build_url: null,
          build_number: null,
          finished_at: null,
          raw_response: {
            ...(run.raw_response || {}),
            normalizedQueueUrl,
            queueExpired: true,
            fallback,
            syncError: 'La cola ya no existe en Jenkins y no se encontró build reciente asociado.',
          },
        };
      }

      throw error;
    }

    if (queueData?.cancelled) {
      return {
        status: 'ABORTED',
        result: 'ABORTED',
        build_url: null,
        build_number: null,
        finished_at: new Date().toISOString(),
        raw_response: {
          ...(run.raw_response || {}),
          normalizedQueueUrl,
          queue: queueData,
          syncMessage: 'La ejecución fue cancelada en la cola de Jenkins.',
        },
      };
    }

    if (queueData?.executable?.url) {
      buildUrl = normalizeJenkinsUrl(String(queueData.executable.url));
      buildNumber = queueData?.executable?.number ? String(queueData.executable.number) : null;
      status = 'RUNNING';
    } else {
      return {
        status: 'QUEUED',
        result: null,
        build_url: null,
        build_number: null,
        finished_at: null,
        raw_response: {
          ...(run.raw_response || {}),
          normalizedQueueUrl,
          queue: queueData,
          syncMessage: queueData?.why || 'La ejecución sigue en cola.',
        },
      };
    }
  }

  if (buildUrl) {
    const normalizedBuildUrl = normalizeJenkinsUrl(buildUrl);

    const buildApi = apiUrl(
      normalizedBuildUrl,
      'tree=building,result,number,url,duration,timestamp,estimatedDuration,queueId'
    );

    buildData = await fetchJenkinsJson(buildApi, authHeader);

    const normalized = normalizeResult(buildData?.result || null, Boolean(buildData?.building));
    status = normalized.status;
    result = normalized.result;
    buildNumber = buildData?.number ? String(buildData.number) : buildNumber;
    buildUrl = normalizeJenkinsUrl(buildData?.url || normalizedBuildUrl);

    return {
      status,
      result,
      build_url: buildUrl,
      build_number: buildNumber,
      finished_at: buildData?.building ? null : new Date().toISOString(),
      raw_response: {
        ...(run.raw_response || {}),
        build: buildData,
        normalizedBuildUrl,
        syncMessage: buildData?.building ? 'Build en ejecución.' : `Build finalizado con resultado ${buildData?.result || 'desconocido'}.`,
      },
    };
  }

  return {
    status: 'QUEUED',
    result: null,
    build_url: null,
    build_number: null,
    finished_at: null,
    raw_response: {
      ...(run.raw_response || {}),
      syncMessage: 'No existe queue_url ni build_url para sincronizar.',
    },
  };
}

export async function POST(req: Request) {
  const { deny } = await requireRM();
  if (deny) return deny;

  const body = await req.json();
  const runId = String(body?.runId || '').trim();

  if (!runId) {
    return NextResponse.json({ ok: false, error: 'Falta runId' }, { status: 400 });
  }

  const supabase = createSupabaseAdmin();

  const { data: run, error: runError } = await supabase
    .from('deployment_runs')
    .select('*')
    .eq('id', runId)
    .single();

  if (runError || !run) {
    return NextResponse.json({ ok: false, error: runError?.message || 'Ejecución no encontrada' }, { status: 404 });
  }

  try {
    const update = await syncFromJenkins(run);

    const { data: updatedRun, error: updateError } = await supabase
      .from('deployment_runs')
      .update({
        status: update.status,
        result: update.result,
        build_url: update.build_url,
        build_number: update.build_number,
        finished_at: update.finished_at,
        raw_response: update.raw_response,
        updated_at: new Date().toISOString(),
      })
      .eq('id', runId)
      .select('*')
      .single();

    if (updateError) {
      return NextResponse.json({ ok: false, error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, run: updatedRun });
  } catch (error: any) {
    const cleanError = error?.message || 'No fue posible actualizar estado Jenkins';

    await supabase
      .from('deployment_runs')
      .update({
        raw_response: {
          ...(run.raw_response || {}),
          syncError: cleanError,
          syncErrorAt: new Date().toISOString(),
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', runId);

    return NextResponse.json({ ok: false, error: cleanError }, { status: 500 });
  }
}
