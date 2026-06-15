import { NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase-admin';
import { requireAnyRole } from '@/lib/auth';

export const dynamic = 'force-dynamic';

type StepInput = {
  id?: string;
  step_order: number;
  activity: string;
  responsible?: string;
  planned_time?: string;
  status?: string;
  evidence_url?: string;
  notes?: string;
};

export async function GET(req: Request) {
  const { deny } = await requireAnyRole(['rm', 'deployment']);
  if (deny) return deny;

  const { searchParams } = new URL(req.url);
  const rdcId = searchParams.get('rdcId');

  if (!rdcId) {
    return NextResponse.json({ ok: false, error: 'Falta rdcId' }, { status: 400 });
  }

  const supabase = createSupabaseAdmin();

  const { data, error } = await supabase
    .from('pap_steps')
    .select('*')
    .eq('rdc_id', rdcId)
    .order('step_order', { ascending: true });

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, steps: data || [] });
}

export async function POST(req: Request) {
  const { user, deny } = await requireAnyRole(['rm', 'deployment']);
  if (deny) return deny;

  const body = await req.json();
  const rdcId = String(body?.rdcId || '').trim();
  const steps = Array.isArray(body?.steps) ? body.steps as StepInput[] : [];

  if (!rdcId) {
    return NextResponse.json({ ok: false, error: 'Falta rdcId' }, { status: 400 });
  }

  const cleanSteps = steps
    .map((step, index) => ({
      rdc_id: rdcId,
      step_order: Number(step.step_order || index + 1),
      activity: String(step.activity || '').trim(),
      responsible: String(step.responsible || '').trim(),
      planned_time: String(step.planned_time || '').trim(),
      status: String(step.status || 'Pendiente').trim(),
      evidence_url: String(step.evidence_url || '').trim(),
      notes: String(step.notes || '').trim(),
      updated_by: user?.email || null,
    }))
    .filter((step) => step.activity);

  const supabase = createSupabaseAdmin();

  const { error: deleteError } = await supabase
    .from('pap_steps')
    .delete()
    .eq('rdc_id', rdcId);

  if (deleteError) {
    return NextResponse.json({ ok: false, error: deleteError.message }, { status: 500 });
  }

  if (cleanSteps.length > 0) {
    const { error: insertError } = await supabase
      .from('pap_steps')
      .insert(cleanSteps);

    if (insertError) {
      return NextResponse.json({ ok: false, error: insertError.message }, { status: 500 });
    }
  }

  await supabase
    .from('rdc')
    .update({ status: 'PAP_CREADO', updated_at: new Date().toISOString() })
    .eq('id', rdcId)
    .in('status', ['APROBADO_PARA_EJECUCION', 'PAP_CREADO', 'EN_IMPLEMENTACION']);

  return NextResponse.json({ ok: true, saved: cleanSteps.length });
}
