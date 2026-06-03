import { NextResponse } from 'next/server';
import { createSupabaseAdmin } from '../../../../lib/supabase-admin';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabase = createSupabaseAdmin();

    const { data, error } = await supabase
      .from('approval_roles')
      .select('*')
      .eq('active', true)
      .order('role_name', { ascending: true })
      .order('approver_name', { ascending: true });

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    const grouped = (data || []).reduce((acc: Record<string, any[]>, item: any) => {
      if (!acc[item.role_name]) acc[item.role_name] = [];
      acc[item.role_name].push(item);
      return acc;
    }, {});

    return NextResponse.json({ ok: true, roles: data || [], grouped });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message || 'Error consultando aprobadores' },
      { status: 500 }
    );
  }
}
