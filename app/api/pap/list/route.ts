import { NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase-admin';
import { requireModuleAccess } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  const { deny } = await requireModuleAccess('plan_pap');
  if (deny) return deny;

  const supabase = createSupabaseAdmin();

  const { data, error } = await supabase
    .from('rdc')
    .select('*, rdc_details(*), approval_requests(*), pap_steps(*)')
    .in('status', ['APROBADO_PARA_EJECUCION', 'PAP_CREADO', 'EN_IMPLEMENTACION', 'IMPLEMENTADO_EXITOSO'])
    .order('proposed_deploy_date', { ascending: true })
    .limit(100);

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, changes: data || [] });
}
