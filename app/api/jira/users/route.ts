import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

function getEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing env ${name}`);
  return value;
}

export async function GET(req: Request) {
  try {
    const { deny } = await requireUser();
    if (deny) return deny;

    const url = new URL(req.url);
    const q = (url.searchParams.get('query') || url.searchParams.get('q') || url.searchParams.get('search') || '').trim();

    if (q.length < 2) {
      return NextResponse.json({ ok: true, users: [] });
    }

    const base = getEnv('JIRA_BASE').replace(/\/$/, '');
    const email = getEnv('JIRA_EMAIL');
    const token = getEnv('JIRA_TOKEN');

    const jiraUrl = `${base}/rest/api/3/user/search?query=${encodeURIComponent(q)}&maxResults=8`;

    const response = await fetch(jiraUrl, {
      headers: {
        Authorization: `Basic ${Buffer.from(`${email}:${token}`).toString('base64')}`,
        Accept: 'application/json',
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      const text = await response.text();
      return NextResponse.json(
        { ok: false, error: `Jira users error ${response.status}: ${text}` },
        { status: response.status }
      );
    }

    const data = await response.json();

    const users = (Array.isArray(data) ? data : [])
      .filter((user: any) => user?.accountType !== 'app')
      .map((user: any) => ({
        accountId: user.accountId,
        displayName: user.displayName,
        emailAddress: user.emailAddress ?? null,
        avatarUrl: user.avatarUrls?.['48x48'] ?? user.avatarUrls?.['24x24'] ?? null,
      }));

    return NextResponse.json({ ok: true, users });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message || 'Error buscando usuarios Jira' },
      { status: 500 }
    );
  }
}
