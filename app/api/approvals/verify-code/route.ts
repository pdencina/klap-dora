import { NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

async function findApprovalByTokenOrId(supabase: any, token: string) {
  const byToken = await supabase.from('approval_requests').select('*').eq('approval_token', token).maybeSingle();
  if (byToken.data) return { data: byToken.data, error: null };
  const byId = await supabase.from('approval_requests').select('*').eq('id', token).maybeSingle();
  return { data: byId.data, error: byId.error || byToken.error };
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const token = String(body?.token || '').trim();
    const code = String(body?.code || '').trim();

    if (!token || !code) return NextResponse.json({ ok: false, error: 'Token y código son requeridos' }, { status: 400 });

    const supabase = createSupabaseAdmin();
    const { data: approval, error } = await findApprovalByTokenOrId(supabase, token);
    if (error || !approval) return NextResponse.json({ ok: false, error: 'Aprobación no encontrada o token inválido' }, { status: 404 });
    if (approval.status !== 'PENDIENTE') return NextResponse.json({ ok: false, error: `Esta aprobación ya fue procesada con estado ${approval.status}` }, { status: 400 });
    if (!approval.approval_code || approval.approval_code !== code) return NextResponse.json({ ok: false, error: 'Código inválido' }, { status: 400 });
    if (approval.approval_code_expires_at && new Date(approval.approval_code_expires_at).getTime() < Date.now()) {
      return NextResponse.json({ ok: false, error: 'Código expirado. Solicita uno nuevo.' }, { status: 400 });
    }

    const verifiedAt = new Date().toISOString();
    const { error: updateError } = await supabase.from('approval_requests').update({ approval_verified_at: verifiedAt }).eq('id', approval.id);
    if (updateError) return NextResponse.json({ ok: false, error: updateError.message }, { status: 500 });

    return NextResponse.json({ ok: true, verifiedAt });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message || 'Error validando código' }, { status: 500 });
  }
}
