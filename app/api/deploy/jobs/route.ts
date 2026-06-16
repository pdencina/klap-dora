import { NextResponse } from 'next/server';
import { requireModuleAccess } from '@/lib/auth';

export const dynamic = 'force-dynamic';

function basicAuth(user: string, token: string) {
  return Buffer.from(`${user}:${token}`).toString('base64');
}

function normalizeJobs(raw: any): Array<{ name: string; url: string; color?: string }> {
  const jobs = Array.isArray(raw?.jobs) ? raw.jobs : [];
  return jobs
    .map((job: any) => ({
      name: String(job?.name || '').trim(),
      url: String(job?.url || '').trim(),
      color: job?.color ? String(job.color) : undefined,
    }))
    .filter((job: any) => job.name)
    .sort((a: any, b: any) => a.name.localeCompare(b.name));
}

export async function GET() {
  const { deny } = await requireModuleAccess('deploy_center');
  if (deny) return deny;

  const baseUrl = process.env.JENKINS_BASE_URL;
  const user = process.env.JENKINS_USER;
  const token = process.env.JENKINS_API_TOKEN;

  if (!baseUrl || !user || !token) {
    return NextResponse.json({
      ok: true,
      mode: 'mock',
      jobs: [
        { name: 'deploy-ticketing-efe-prod', url: '', color: 'notbuilt' },
        { name: 'POS-PROD', url: '', color: 'notbuilt' },
        { name: 'POS-QA', url: '', color: 'notbuilt' },
        { name: 'APP-VALIDATOR', url: '', color: 'notbuilt' },
      ],
      warning: 'Jenkins no está configurado. Mostrando jobs demo.',
    });
  }

  try {
    const response = await fetch(`${baseUrl.replace(/\/$/, '')}/api/json?tree=jobs[name,url,color]`, {
      headers: {
        Authorization: `Basic ${basicAuth(user, token)}`,
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      const text = await response.text();
      return NextResponse.json(
        { ok: false, error: `Jenkins respondió ${response.status}: ${text.slice(0, 400)}` },
        { status: 502 },
      );
    }

    const data = await response.json();
    return NextResponse.json({ ok: true, mode: 'jenkins', jobs: normalizeJobs(data) });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message || 'No fue posible consultar Jenkins' },
      { status: 502 },
    );
  }
}
