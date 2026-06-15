import { NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase-admin';
import { requireActionPermission } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const { deny } = await requireActionPermission('update_jenkins_status');
  if (deny) return deny;

  const { searchParams } = new URL(req.url);
  const rdcId = searchParams.get('rdcId');

  const supabase = createSupabaseAdmin();

  let query = supabase
    .from('deployment_runs')
    .select('*')
    .order('triggered_at', { ascending: false })
    .limit(50);

  if (rdcId) query = query.eq('rdc_id', rdcId);

  const { data, error } = await query;

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, runs: data || [] });
}

export async function PATCH(req: Request) {
  const { deny } = await requireActionPermission('update_jenkins_status');
  if (deny) return deny;

  const body = await req.json();
  const runId = String(body?.runId || '').trim();
  const status = String(body?.status || '').trim();
  const result = body?.result ? String(body.result).trim() : null;

  if (!runId) return NextResponse.json({ ok: false, error: 'Falta runId' }, { status: 400 });
  if (!status) return NextResponse.json({ ok: false, error: 'Falta status' }, { status: 400 });

  const supabase = createSupabaseAdmin();

  const payload: Record<string, any> = {
    status,
    result,
    updated_at: new Date().toISOString(),
  };

  if (['SUCCESS', 'FAILURE', 'ABORTED'].includes(status) || ['SUCCESS', 'FAILURE', 'ABORTED'].includes(String(result || ''))) {
    payload.finished_at = new Date().toISOString();
  }

  const { data, error } = await supabase
    .from('deployment_runs')
    .update(payload)
    .eq('id', runId)
    .select('*')
    .single();

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, run: data });
}
