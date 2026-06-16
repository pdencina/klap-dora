import { NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase-admin';
import { requireModuleAccess } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  const { user, deny } = await requireModuleAccess('mis_aprobaciones');
  if (deny) return deny;

  const supabase = createSupabaseAdmin();

  let query = supabase
    .from('approval_requests')
    .select('*, rdc(*)')
    .order('created_at', { ascending: false })
    .limit(100);

  // RM puede usar esta bandeja como prueba, pero el aprobador solo ve lo asignado a su correo.
  const role = String(user?.app_metadata?.role || '').toLowerCase();
  if (role !== 'rm') {
    query = query.eq('approver_email', user!.email);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, approvals: data || [] });
}
