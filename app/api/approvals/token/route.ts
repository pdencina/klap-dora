import { NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

async function findApprovalByTokenOrId(supabase: any, token: string) {
  const byToken = await supabase
    .from('approval_requests')
    .select('*')
    .eq('approval_token', token)
    .maybeSingle();

  if (byToken.data) return { data: byToken.data, error: null };

  const byId = await supabase
    .from('approval_requests')
    .select('*')
    .eq('id', token)
    .maybeSingle();

  return { data: byId.data, error: byId.error || byToken.error };
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const token = String(url.searchParams.get('token') || '').trim();

    if (!token) {
      return NextResponse.json({ ok: false, error: 'Token requerido' }, { status: 400 });
    }

    const supabase = createSupabaseAdmin();
    const { data: approval, error } = await findApprovalByTokenOrId(supabase, token);

    if (error || !approval) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Aprobación no encontrada o token inválido',
          debug: {
            token,
            supabaseError: error?.message || null,
          },
        },
        { status: 404 }
      );
    }

    let rdc = null;

    if (approval.rdc_id) {
      const { data: rdcRow } = await supabase
        .from('rdc')
        .select('*')
        .eq('id', approval.rdc_id)
        .maybeSingle();

      rdc = rdcRow || null;
    }

    return NextResponse.json({
      ok: true,
      approval: {
        ...approval,
        rdc,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message || 'Error consultando aprobación' },
      { status: 500 }
    );
  }
}
