import { NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase-admin';
import { requireUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// Devuelve SOLO los RDC creados por el usuario autenticado.
export async function GET() {
  const { user, deny } = await requireUser();
  if (deny) return deny;

  const supabase = createSupabaseAdmin();

  const { data, error } = await supabase
    .from('rdc')
    .select('*, approval_requests(*)')
    .eq('created_by', user!.email)
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, changes: data || [] });
}
