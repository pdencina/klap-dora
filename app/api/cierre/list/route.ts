import { NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase-admin';
import { requireActionPermission } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  const { deny } = await requireActionPermission('close_change');
  if (deny) return deny;

  const supabase = createSupabaseAdmin();

  const { data, error } = await supabase
    .from('rdc')
    .select('*, approval_requests(*), pap_steps(*), deployment_runs(*), change_closures(*)')
    .in('status', ['EN_IMPLEMENTACION', 'IMPLEMENTADO_EXITOSO', 'IMPLEMENTADO_CON_INCIDENTE', 'ROLLBACK', 'CERRADO', 'PAP_CREADO'])
    .order('updated_at', { ascending: false })
    .limit(100);

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, changes: data || [] });
}
