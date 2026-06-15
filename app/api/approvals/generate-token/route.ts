import { NextResponse } from 'next/server';
import { requireRM } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST() {
  const { deny } = await requireRM();
  if (deny) return deny;

  return NextResponse.json({
    ok: true,
    token: crypto.randomUUID(),
  });
}
