import { NextResponse } from 'next/server';
import { createSupabaseAdmin } from '../../../../lib/supabase-admin';
import { requireUser, roleOf } from '../../../../lib/auth';

export const dynamic = 'force-dynamic';

// Devuelve un RDC por id. Solo lo ve su creador (client) o un RM.
export async function GET(req: Request) {
  const { user, deny } = await requireUser();
  if (deny) return deny;

  const id = new URL(req.url).searchParams.get('id')?.trim();
  if (!id) return NextResponse.json({ ok: false, error: 'id requerido' }, { status: 400 });

  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase
    .from('rdc')
    .select('*, rdc_details(*), approval_requests(*)')
    .eq('id', id)
    .single();

  if (error || !data) {
    return NextResponse.json({ ok: false, error: error?.message || 'RDC no encontrado' }, { status: 404 });
  }

  if (roleOf(user) !== 'rm' && data.created_by !== user!.email) {
    return NextResponse.json({ ok: false, error: 'No tienes permiso para ver este RDC' }, { status: 403 });
  }

  return NextResponse.json({ ok: true, change: data });
}
