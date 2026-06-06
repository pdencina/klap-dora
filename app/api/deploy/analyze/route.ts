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

function cleanLine(line: string) {
  return String(line || '')
    .replace(/\x1b\[[0-9;]*m/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function isGenericLine(line: string) {
  const lower = line.toLowerCase();

  return [
    'running on jenkins',
    'running in ',
    'git init',
    'git fetch',
    'git config',
    'git rev-parse',
    'git checkout',
    'using credential',
    'checking out revision',
    'using git',
    'recommended git tool',
    'workspace/',
    'obtained jenkinsfile',
    'lightweight checkout support',
    'the recommended git tool is',
  ].some((generic) => lower.includes(generic));
}

function extractRelevantLines(consoleText: string, limit = 12) {
  const lines = consoleText.split(/\r?\n/).map(cleanLine).filter(Boolean);

  const criticalPatterns = [
    /BUILD FAILURE/i,
    /Finished: FAILURE/i,
    /script returned exit code/i,
    /Failed to execute goal/i,
    /There are test failures/i,
    /Tests run:.*Failures:/i,
    /Failed tests?:/i,
    /\[ERROR\]/i,
    /npm ERR!/i,
    /yarn error/i,
    /pnpm ERR!/i,
    /Exception in thread/i,
    /Caused by:/i,
    /Compilation failure/i,
    /permission denied/i,
    /access denied/i,
    /timed out|timeout/i,
    /ImagePullBackOff|CrashLoopBackOff/i,
    /helm.*failed|kubectl.*error/i,
    /fallo|falla|fallido/i,
  ];

  const secondaryPatterns = [
    /FAILURE/i,
    /ERROR/i,
    /Exception/i,
    /failed/i,
    /test/i,
    /maven/i,
    /gradle/i,
    /junit/i,
    /surefire/i,
  ];

  const selected: string[] = [];

  function addWithContext(index: number, radius: number) {
    const start = Math.max(0, index - radius);
    const end = Math.min(lines.length - 1, index + radius);

    for (let i = start; i <= end; i++) {
      const line = lines[i];
      if (!line || isGenericLine(line)) continue;
      const numbered = `${i + 1}: ${line.slice(0, 280)}`;
      if (!selected.includes(numbered)) selected.push(numbered);
      if (selected.length >= limit) return;
    }
  }

  for (let i = 0; i < lines.length; i++) {
    if (criticalPatterns.some((pattern) => pattern.test(lines[i])) && !isGenericLine(lines[i])) {
      addWithContext(i, 2);
    }
    if (selected.length >= limit) break;
  }

  if (selected.length < Math.min(5, limit)) {
    for (let i = 0; i < lines.length; i++) {
      if (secondaryPatterns.some((pattern) => pattern.test(lines[i])) && !isGenericLine(lines[i])) {
        addWithContext(i, 1);
      }
      if (selected.length >= limit) break;
    }
  }

  if (selected.length === 0) {
    const tail = lines
      .filter((line) => !isGenericLine(line))
      .slice(-limit)
      .map((line, index) => `tail-${index + 1}: ${line.slice(0, 280)}`);

    return tail;
  }

  return selected.slice(0, limit);
}

function stageHint(consoleText: string) {
  const lower = consoleText.toLowerCase();

  if (lower.includes('test') || lower.includes('surefire') || lower.includes('junit') || lower.includes('jest')) {
    return 'pruebas automatizadas/unitarias';
  }

  if (lower.includes('compilation failure') || lower.includes('maven') || lower.includes('gradle')) {
    return 'compilación/build';
  }

  if (lower.includes('docker') || lower.includes('image')) {
    return 'construcción/publicación de imagen';
  }

  if (lower.includes('kubectl') || lower.includes('helm') || lower.includes('kubernetes')) {
    return 'despliegue Kubernetes/Helm';
  }

  if (lower.includes('permission denied') || lower.includes('access denied')) {
    return 'permisos/credenciales';
  }

  return 'ejecución del pipeline';
}

function analyzeConsole(consoleText: string, run: any) {
  const text = consoleText || '';
  const lower = text.toLowerCase();

  const findings: string[] = [];
  const recommendedSteps: string[] = [];
  let probableCause = `El pipeline falló durante la etapa de ${stageHint(text)}.`;

  const hasTestFailure =
    /test failed|tests failed|failed tests|there are test failures|surefire|junit|jest|unit test|test unitario|falla test|fallo intencional/i.test(text);

  const hasMavenGradle =
    /Failed to execute goal|BUILD FAILURE|maven|gradle|compilation failure/i.test(text);

  const hasTimeout =
    /timeout|timed out/i.test(text);

  const hasPermission =
    /permission denied|access denied|forbidden|unauthorized/i.test(text);

  const hasDocker =
    /docker|imagepullbackoff|container|registry/i.test(text);

  const hasKube =
    /kubernetes|kubectl|helm|namespace|CrashLoopBackOff/i.test(text);

  if (hasTestFailure) {
    probableCause = 'El pipeline parece fallar por pruebas automatizadas/unitarias.';
    findings.push('Se detectaron señales de tests fallidos en el log de Jenkins.');
    recommendedSteps.push('Abrir el Console Output y ubicar la primera prueba fallida, no solo el último error.');
    recommendedSteps.push('Revisar el último commit asociado al build y validar cambios relacionados a tests.');
    recommendedSteps.push('Ejecutar la suite de pruebas localmente o en ambiente QA antes de reintentar el despliegue.');
    recommendedSteps.push('Si el fallo fue intencional o de prueba, revertir ese commit o ajustar el test antes de redeploy.');
  }

  if (hasMavenGradle) {
    findings.push('Se detectaron señales de build Java/Maven/Gradle.');
    recommendedSteps.push('Validar compilación, dependencias y versión JDK usada por el agente Jenkins.');
    recommendedSteps.push('Buscar en el log la primera aparición de BUILD FAILURE o Failed to execute goal.');
  }

  if (hasTimeout) {
    findings.push('Se detectaron señales de timeout.');
    recommendedSteps.push('Revisar tiempos de espera del job, conectividad con ambiente destino y performance del servicio.');
  }

  if (hasPermission) {
    probableCause = 'El pipeline parece fallar por permisos o credenciales.';
    findings.push('Se detectaron mensajes de permisos o acceso denegado.');
    recommendedSteps.push('Validar permisos del usuario Jenkins, credenciales del job y acceso a repositorios/ambiente.');
  }

  if (hasDocker) {
    findings.push('Se detectaron señales relacionadas a Docker/imagen/contenedor.');
    recommendedSteps.push('Validar construcción de imagen, registry, tag publicado y credenciales del registry.');
  }

  if (hasKube) {
    findings.push('Se detectaron señales relacionadas a Kubernetes/Helm.');
    recommendedSteps.push('Validar namespace, kubeconfig, permisos RBAC, chart/values y estado de pods.');
  }

  if (findings.length === 0) {
    findings.push('No se encontraron patrones conocidos en el log leído automáticamente.');
    recommendedSteps.push('Revisar el Console Output completo en Jenkins.');
    recommendedSteps.push('Identificar la primera línea de error real antes de reintentar.');
    recommendedSteps.push('Confirmar branch/tag, variables y credenciales del pipeline.');
  }

  const evidenceLines = extractRelevantLines(text);

  const copyText = [
    `Análisis Jenkins - ${run.job_name || 'pipeline'}`,
    `Build: ${run.build_number || 'N/D'}`,
    `Causa probable: ${probableCause}`,
    '',
    'Hallazgos:',
    ...findings.map((item) => `- ${item}`),
    '',
    'Pasos recomendados:',
    ...Array.from(new Set(recommendedSteps)).map((item, index) => `${index + 1}. ${item}`),
    '',
    'Líneas relevantes:',
    ...evidenceLines.map((item) => `- ${item}`),
    '',
    `Jenkins: ${run.build_url || ''}`,
  ].join('\n');

  return {
    title: run.result === 'SUCCESS' ? 'El build finalizó exitosamente' : 'Análisis inicial del fallo Jenkins',
    probableCause,
    findings,
    recommendedSteps: Array.from(new Set(recommendedSteps)).slice(0, 8),
    evidenceLines,
    buildUrl: run.build_url,
    buildNumber: run.build_number,
    copyText,
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
