import { NextResponse } from 'next/server';
import { createSupabaseAdmin } from '../../../../lib/supabase-admin';
import { requireRM } from '../../../../lib/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const { deny } = await requireRM();
    if (deny) return deny;

    const supabase = createSupabaseAdmin();

    const { data, error } = await supabase
      .from('rdc')
      .select('*, approval_requests(*)')
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, changes: data || [] });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message || 'Error consultando aprobaciones' }, { status: 500 });
  }
}
