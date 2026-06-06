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

function consoleUrl(buildUrl: string) {
  return `${normalizeJenkinsUrl(buildUrl)}/consoleText`;
}

async function fetchConsoleText(buildUrl: string) {
  const url = consoleUrl(buildUrl);
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: getAuthHeader(),
      Accept: 'text/plain,*/*',
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`No fue posible leer el consoleText de Jenkins (${response.status}). ${text.slice(0, 300)}`);
  }

  return response.text();
}

function pickLines(consoleText: string, patterns: RegExp[], limit = 10) {
  const lines = consoleText.split(/\r?\n/);
  const matches: string[] = [];

  for (const line of lines) {
    if (patterns.some((pattern) => pattern.test(line))) {
      const clean = line.trim();
      if (clean && !matches.includes(clean)) matches.push(clean.slice(0, 260));
    }
    if (matches.length >= limit) break;
  }

  return matches;
}

function analyzeConsole(consoleText: string, run: any) {
  const text = consoleText || '';
  const lower = text.toLowerCase();

  const findings: string[] = [];
  const recommendedSteps: string[] = [];
  let probableCause = 'No se detectó una causa única. Revisa el log completo en Jenkins.';

  const testSignals = [
    'test failed',
    'tests failed',
    'failed tests',
    'there are test failures',
    'surefire',
    'jest',
    'junit',
    'unit test',
    'test unitario',
    'falla test',
    'fallo intencional',
    'npm test',
    'mvn test',
    'gradle test',
  ];

  if (testSignals.some((signal) => lower.includes(signal))) {
    probableCause = 'El pipeline parece fallar por pruebas automatizadas/unitarias.';
    findings.push('Se detectaron señales de tests fallidos en el log de Jenkins.');
    recommendedSteps.push('Abrir el Console Output y ubicar la primera prueba fallida, no solo el último error.');
    recommendedSteps.push('Revisar el último commit asociado al build y validar cambios relacionados a tests.');
    recommendedSteps.push('Ejecutar la suite de pruebas localmente o en ambiente QA antes de reintentar el despliegue.');
    recommendedSteps.push('Si el fallo fue intencional o de prueba, revertir ese commit o ajustar el test antes de redeploy.');
  }

  if (lower.includes('permission denied') || lower.includes('access denied') || lower.includes('forbidden')) {
    probableCause = 'El pipeline parece fallar por permisos.';
    findings.push('Se detectaron mensajes de permisos o acceso denegado.');
    recommendedSteps.push('Validar permisos del usuario Jenkins, credenciales del job y acceso a repositorios/ambiente.');
  }

  if (lower.includes('npm err') || lower.includes('yarn error') || lower.includes('pnpm')) {
    findings.push('Se detectaron errores asociados a dependencias Node/NPM/Yarn/PNPM.');
    recommendedSteps.push('Revisar instalación de dependencias, lockfile y versión de Node configurada en Jenkins.');
  }

  if (lower.includes('maven') || lower.includes('gradle') || lower.includes('compilation failure')) {
    findings.push('Se detectaron señales de build Java/Maven/Gradle.');
    recommendedSteps.push('Validar compilación, dependencias y versión JDK usada por el agente Jenkins.');
  }

  if (lower.includes('docker') || lower.includes('imagepullbackoff') || lower.includes('container')) {
    findings.push('Se detectaron señales relacionadas a Docker/imagen/contenedor.');
    recommendedSteps.push('Validar construcción de imagen, registry, tag publicado y credenciales del registry.');
  }

  if (lower.includes('kubernetes') || lower.includes('kubectl') || lower.includes('helm')) {
    findings.push('Se detectaron señales relacionadas a Kubernetes/Helm.');
    recommendedSteps.push('Validar namespace, kubeconfig, permisos RBAC, chart/values y estado de pods.');
  }

  if (lower.includes('timeout') || lower.includes('timed out')) {
    findings.push('Se detectaron señales de timeout.');
    recommendedSteps.push('Revisar tiempos de espera del job, conectividad con ambiente destino y performance del servicio.');
  }

  if (findings.length === 0) {
    findings.push('No se encontraron patrones conocidos en el log leído automáticamente.');
    recommendedSteps.push('Revisar el Console Output completo en Jenkins.');
    recommendedSteps.push('Identificar la primera línea de error real antes de reintentar.');
    recommendedSteps.push('Confirmar branch/tag, variables y credenciales del pipeline.');
  }

  const evidenceLines = pickLines(text, [
    /error/i,
    /failed/i,
    /failure/i,
    /test/i,
    /exception/i,
    /permission/i,
    /denied/i,
    /timeout/i,
    /fallo/i,
    /falla/i,
  ]);

  return {
    title: run.result === 'SUCCESS' ? 'El build finalizó exitosamente' : 'Análisis inicial del fallo Jenkins',
    probableCause,
    findings,
    recommendedSteps: Array.from(new Set(recommendedSteps)).slice(0, 8),
    evidenceLines,
    buildUrl: run.build_url,
    buildNumber: run.build_number,
    disclaimer: 'Este análisis es una recomendación inicial basada en patrones del log. La causa definitiva debe validarse en Jenkins/Console Output.',
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

  const { data: run, error } = await supabase
    .from('deployment_runs')
    .select('*')
    .eq('id', runId)
    .single();

  if (error || !run) {
    return NextResponse.json({ ok: false, error: error?.message || 'Ejecución no encontrada' }, { status: 404 });
  }

  if (!run.build_url) {
    return NextResponse.json({ ok: false, error: 'La ejecución aún no tiene build_url. Primero actualiza el estado Jenkins.' }, { status: 409 });
  }

  try {
    const consoleText = await fetchConsoleText(run.build_url);
    const analysis = analyzeConsole(consoleText, run);

    await supabase
      .from('deployment_runs')
      .update({
        raw_response: {
          ...(run.raw_response || {}),
          ai_analysis: analysis,
          ai_analysis_at: new Date().toISOString(),
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', runId);

    return NextResponse.json({ ok: true, analysis });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || 'No fue posible analizar el fallo Jenkins' }, { status: 500 });
  }
}
