import { NextResponse } from 'next/server';
import { createSupabaseServer } from './supabase-server';

export type Role = 'user' | 'rm';

// getUser() valida el JWT contra el servidor de Supabase (seguro),
// a diferencia de getSession() que solo lee la cookie.
export async function getCurrentUser() {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export function roleOf(user: any): Role {
  return user?.app_metadata?.role === 'rm' ? 'rm' : 'user';
}

// Usar al inicio de un Route Handler que requiere usuario logueado:
//   const { user, deny } = await requireUser();
//   if (deny) return deny;
export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) {
    return { user: null, deny: NextResponse.json({ ok: false, error: 'No autenticado' }, { status: 401 }) };
  }
  return { user, deny: null as NextResponse | null };
}

// Usar al inicio de un Route Handler que requiere rol Release Manager.
export async function requireRM() {
  const { user, deny } = await requireUser();
  if (deny) return { user: null, deny };
  if (roleOf(user) !== 'rm') {
    return { user: null, deny: NextResponse.json({ ok: false, error: 'Requiere rol Release Manager' }, { status: 403 }) };
  }
  return { user, deny: null as NextResponse | null };
}
