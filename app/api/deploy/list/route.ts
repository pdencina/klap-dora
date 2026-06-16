import { NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase-admin';
import { requireModuleAccess } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  const { deny } = await requireModuleAccess('deploy_center');
  if (deny) return deny;

  const supabase = createSupabaseAdmin();

  const { data: changes, error: changesError } = await supabase
    .from('rdc')
    .select('*, approval_requests(*), pap_steps(*), deployment_runs(*), rdc_details(*)')
    .in('status', ['APROBADO_PARA_EJECUCION', 'PAP_CREADO', 'EN_IMPLEMENTACION', 'IMPLEMENTADO_EXITOSO'])
    .order('proposed_deploy_date', { ascending: true })
    .limit(80);

  if (changesError) {
    return NextResponse.json({ ok: false, error: changesError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, changes: changes || [] });
}
