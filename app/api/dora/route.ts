import { NextResponse } from 'next/server';
import { requireRM } from '../../../lib/auth';

export const dynamic = 'force-dynamic';

type JiraIssue = {
  key: string;
  fields: Record<string, any>;
};

type YearRow = {
  year: string;
  deployments: number;
  failures: number;
  total: number;
  failureRate: number;
  successRate: number;
  months: number[];
};

function env(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing env var: ${name}`);
  return value;
}

function optionalEnv(name: string): string | null {
  return process.env[name] || null;
}

function optionValue(value: any): string | null {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && 'value' in value) return value.value;
  if (typeof value === 'object' && 'name' in value) return value.name;
  if (Array.isArray(value)) return value.map(optionValue).filter(Boolean).join(', ');
  return String(value);
}

function parseDate(value: any): Date | null {
  if (!value || typeof value !== 'string') return null;

  if (/^\d{4}-\d{2}-\d{2}/.test(value)) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  if (/^\d{2}\/\d{2}\/\d{4}$/.test(value)) {
    const [day, month, year] = value.split('/');
    const date = new Date(`${year}-${month}-${day}`);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  if (/^\d{2}-\d{2}-\d{4}$/.test(value)) {
    const [day, month, year] = value.split('-');
    const date = new Date(`${year}-${month}-${day}`);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function diffDays(start: Date, end: Date): number {
  return Math.max(0, Math.round((end.getTime() - start.getTime()) / 86400000));
}

function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function percentile(values: number[], p: number): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.min(Math.max(index, 0), sorted.length - 1)];
}

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function ratio(value: number, total: number) {
  return total ? Number(((value / total) * 100).toFixed(1)) : 0;
}

function normalizeKey(value: string) {
  return value.trim().toLowerCase();
}

function topEntries(data: Record<string, number>, limit = 5) {
  return Object.entries(data)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([name, count]) => ({ name, count }));
}

async function fetchJiraIssues() {
  const base = env('JIRA_BASE').replace(/\/$/, '');
  const email = env('JIRA_EMAIL');
  const token = env('JIRA_TOKEN');
  const project = env('JIRA_PROJECT');

  const cfInicio = env('CF_FINICIO');
  const cfDeploy = env('CF_FDEPLOY');
  const cfResultado = env('CF_RESULTADO');
  const cfTipo = env('CF_TIPO');
  const cfCelula = optionalEnv('CF_CELULA');
  const cfSistema = optionalEnv('CF_SISTEMA');

  const auth = Buffer.from(`${email}:${token}`).toString('base64');
  const fields = [
    'summary',
    'created',
    cfInicio,
    cfDeploy,
    cfResultado,
    cfTipo,
    ...(cfCelula ? [cfCelula] : []),
    ...(cfSistema ? [cfSistema] : []),
  ];
  const jql = `project = ${project} ORDER BY created DESC`;

  const issues: JiraIssue[] = [];
  let nextPageToken: string | undefined = undefined;
  const seenTokens = new Set<string>();

  do {
    const body: Record<string, any> = {
      jql,
      maxResults: 100,
      fields,
    };

    if (nextPageToken) body.nextPageToken = nextPageToken;

    const res = await fetch(`${base}/rest/api/3/search/jql`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      cache: 'no-store',
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Jira error ${res.status}: ${text}`);
    }

    const data = await res.json();
    issues.push(...(data.issues ?? []));

    nextPageToken = data.nextPageToken;
    if (nextPageToken && seenTokens.has(nextPageToken)) break;
    if (nextPageToken) seenTokens.add(nextPageToken);
  } while (nextPageToken);

  return { issues, cfInicio, cfDeploy, cfResultado, cfTipo, cfCelula, cfSistema };
}

export async function GET(request: Request) {
  try {
    const { deny } = await requireRM();
    if (deny) return deny;

    const { issues, cfInicio, cfDeploy, cfResultado, cfTipo, cfCelula, cfSistema } = await fetchJiraIssues();

    const selectedYear = new URL(request.url).searchParams.get('year');
    const issueYear = (issue: JiraIssue) => {
      const f = issue.fields;
      const deploy = parseDate(f[cfDeploy]);
      const created = parseDate(f.created);
      const date = deploy ?? created;
      return date ? String(date.getFullYear()) : null;
    };

    const availableYears = Array.from(
      new Set(issues.map(issueYear).filter((year): year is string => Boolean(year)))
    ).sort();

    const scopedIssues = selectedYear && selectedYear !== 'all'
      ? issues.filter((issue) => issueYear(issue) === selectedYear)
      : issues;

    const failureResults = new Set(['Rollback', 'Fallido', 'Completado con errores']);
    const deployDates: Date[] = [];
    const leadTimes: number[] = [];
    const byResultado: Record<string, number> = {};
    const byCategoria: Record<string, number> = {};
    const byCelula: Record<string, number> = {};
    const bySistema: Record<string, number> = {};
    const monthly: Record<string, { deployments: number; failures: number; total: number }> = {};
    const yearly: Record<string, { deployments: number; failures: number; total: number }> = {};
    const yearlyMonthly: Record<string, number[]> = {};

    let failures = 0;
    let rollbacks = 0;
    let hotfixes = 0;
    let withDeployDate = 0;
    let withInicioDate = 0;
    let withResultado = 0;
    let withCategoria = 0;

    for (const issue of scopedIssues) {
      const f = issue.fields;
      const inicio = parseDate(f[cfInicio]);
      const deploy = parseDate(f[cfDeploy]);
      const created = parseDate(f.created);
      const resultado = optionValue(f[cfResultado]) ?? 'Sin resultado';
      const categoria = optionValue(f[cfTipo]) ?? 'Sin categoría';
      const celula = cfCelula ? optionValue(f[cfCelula]) ?? 'Sin célula' : 'Sin célula';
      const sistema = cfSistema ? optionValue(f[cfSistema]) ?? 'Sin sistema' : 'Sin sistema';
      const baseDate = deploy ?? created;

      if (inicio) withInicioDate++;
      if (deploy) withDeployDate++;
      if (normalizeKey(resultado) !== 'sin resultado') withResultado++;
      if (normalizeKey(categoria) !== 'sin categoría') withCategoria++;

      if (baseDate) {
        const y = String(baseDate.getFullYear());
        yearly[y] ??= { deployments: 0, failures: 0, total: 0 };
        yearly[y].total += 1;
      }

      if (deploy) {
        deployDates.push(deploy);

        const mKey = monthKey(deploy);
        monthly[mKey] ??= { deployments: 0, failures: 0, total: 0 };
        monthly[mKey].deployments += 1;
        monthly[mKey].total += 1;

        const y = String(deploy.getFullYear());
        yearly[y] ??= { deployments: 0, failures: 0, total: 0 };
        yearly[y].deployments += 1;
        yearlyMonthly[y] ??= Array(12).fill(0);
        yearlyMonthly[y][deploy.getMonth()] += 1;
      }

      if (inicio && deploy) leadTimes.push(diffDays(inicio, deploy));

      if (normalizeKey(categoria) === 'hotfix') hotfixes++;

      if (failureResults.has(resultado)) {
        failures++;
        if (resultado === 'Rollback') rollbacks++;

        if (baseDate) {
          const y = String(baseDate.getFullYear());
          yearly[y] ??= { deployments: 0, failures: 0, total: 0 };
          yearly[y].failures += 1;
        }

        if (deploy) {
          const mKey = monthKey(deploy);
          monthly[mKey] ??= { deployments: 0, failures: 0, total: 0 };
          monthly[mKey].failures += 1;
        }
      }

      byResultado[resultado] = (byResultado[resultado] ?? 0) + 1;
      byCategoria[categoria] = (byCategoria[categoria] ?? 0) + 1;
      byCelula[celula] = (byCelula[celula] ?? 0) + 1;
      bySistema[sistema] = (bySistema[sistema] ?? 0) + 1;
    }

    const months = Object.entries(monthly)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, value]) => ({
        month,
        ...value,
        failureRate: ratio(value.failures, value.total),
      }));

    const years: YearRow[] = Object.entries(yearly)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([year, value]) => ({
        year,
        ...value,
        failureRate: ratio(value.failures, value.total),
        successRate: Number((100 - ratio(value.failures, value.total)).toFixed(1)),
        months: yearlyMonthly[year] ?? Array(12).fill(0),
      }));

    const total = scopedIssues.length;
    const deployments = deployDates.length;
    const changeFailureRate = ratio(failures, total);
    const successRate = Number((100 - changeFailureRate).toFixed(1));
    const dataQuality = ratio(withDeployDate, total);
    const rollbackRate = ratio(rollbacks, total);
    const hotfixRate = ratio(hotfixes, total);

    const topCategory = topEntries(byCategoria, 1)[0];
    const topMonth = months.reduce((best, current) => (!best || current.deployments > best.deployments ? current : best), null as null | (typeof months)[number]);

    const insights = [
      changeFailureRate <= 15
        ? `La tasa de falla está en ${changeFailureRate}%, dentro de un rango saludable para el flujo de producción.`
        : `La tasa de falla está en ${changeFailureRate}%, requiere revisión operativa.`,
      topCategory
        ? `${topCategory.name} concentra ${ratio(topCategory.count, total)}% del volumen total de cambios.`
        : 'No hay categoría dominante identificada.',
      topMonth
        ? `${topMonth.month} fue el período con mayor volumen: ${topMonth.deployments} despliegues.`
        : 'No hay meses con despliegues registrados.',
      `La calidad de fechas deploy es ${dataQuality}%. Faltan ${Math.max(0, total - withDeployDate)} tickets por completar.`,
      `Rollback representa ${rollbackRate}% del total (${rollbacks} tickets).`,
    ];

    return NextResponse.json({
      source: 'jira-live',
      project: process.env.JIRA_PROJECT,
      totalIssues: total,
      metrics: {
        deployments,
        medianLeadTimeDays: median(leadTimes),
        p90LeadTimeDays: percentile(leadTimes, 90),
        changeFailureRate,
        successRate,
        failures,
        rollbacks,
        rollbackRate,
        hotfixes,
        hotfixRate,
      },
      quality: {
        deployDateCoverage: dataQuality,
        inicioDateCoverage: ratio(withInicioDate, total),
        resultadoCoverage: ratio(withResultado, total),
        categoriaCoverage: ratio(withCategoria, total),
        missingDeployDates: Math.max(0, total - withDeployDate),
        missingInicioDates: Math.max(0, total - withInicioDate),
      },
      breakdowns: { byResultado, byCategoria, byCelula, bySistema },
      top: {
        categorias: topEntries(byCategoria, 6),
        resultados: topEntries(byResultado, 6),
        celulas: cfCelula ? topEntries(byCelula, 6) : [],
        sistemas: cfSistema ? topEntries(bySistema, 6) : [],
      },
      monthly,
      months,
      yearly,
      years,
      insights,
      filters: {
        selectedYear: selectedYear ?? 'all',
        availableYears,
      },
      sample: scopedIssues.slice(0, 12).map((i: any) => ({
        key: i.key,
        summary: i.fields.summary,
        fechaInicio: i.fields[cfInicio] ?? null,
        fechaDeploy: i.fields[cfDeploy] ?? null,
        resultado: optionValue(i.fields[cfResultado]) ?? 'Sin resultado',
        categoria: optionValue(i.fields[cfTipo]) ?? 'Sin categoría',
        celula: cfCelula ? optionValue(i.fields[cfCelula]) ?? 'Sin célula' : null,
        sistema: cfSistema ? optionValue(i.fields[cfSistema]) ?? 'Sin sistema' : null,
      })),
    });
  } catch (error: any) {
    return NextResponse.json(
      { source: 'jira-live', ok: false, error: error?.message ?? 'Unknown error' },
      { status: 500 }
    );
  }
}
