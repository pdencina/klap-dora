import { NextResponse } from 'next/server';
import { requireDeployAccess } from '../../../../lib/auth';

export const dynamic = 'force-dynamic';

function cleanJenkinsJobName(value: string) {
  return String(value || '')
    .replace(/\s+·\s+.*$/, '')
    .replace(/\s+-\s+OK$/, '')
    .trim();
}

function buildJenkinsPipelineUrl(baseUrl: string, jobName: string) {
  const cleanBase = String(baseUrl || '').replace(/\/$/, '');
  const cleanJob = cleanJenkinsJobName(jobName);

  if (!cleanBase || !cleanJob) return '';

  if (cleanJob.includes('/job/')) {
    return cleanJob.startsWith('http') ? cleanJob : `${cleanBase}/${cleanJob.replace(/^\//, '')}`;
  }

  if (cleanJob.includes('/')) {
    return `${cleanBase}/job/${cleanJob.split('/').map(encodeURIComponent).join('/job/')}/`;
  }

  return `${cleanBase}/job/${encodeURIComponent(cleanJob)}/`;
}

export async function GET(req: Request) {
  const { deny } = await requireDeployAccess();
  if (deny) return deny;

  const { searchParams } = new URL(req.url);
  const jobName = String(searchParams.get('jobName') || '').trim();

  if (!jobName) {
    return NextResponse.json({ ok: false, error: 'Falta jobName' }, { status: 400 });
  }

  const baseUrl = process.env.JENKINS_BASE_URL;

  if (!baseUrl) {
    return NextResponse.json({ ok: false, error: 'Falta JENKINS_BASE_URL' }, { status: 500 });
  }

  const pipelineUrl = buildJenkinsPipelineUrl(baseUrl, jobName);

  return NextResponse.json({
    ok: true,
    pipelineUrl,
  });
}
