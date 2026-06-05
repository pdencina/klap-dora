import { NextResponse } from 'next/server';
import { createSupabaseServer } from './supabase-server';

export type Role = 'client' | 'approver' | 'rm';

// getUser() valida el JWT contra el servidor de Supabase.
export async function getCurrentUser() {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export function roleOf(user: any): Role {
  const raw = String(user?.app_metadata?.role || user?.user_metadata?.role || '').toLowerCase();

  if (raw === 'rm' || raw === 'release_manager' || raw === 'release-manager') return 'rm';
  if (raw === 'approver' || raw === 'aprobador') return 'approver';

  // Compatibilidad con usuarios antiguos: antes el rol por defecto era "user".
  return 'client';
}

export function roleLabel(role: Role) {
  if (role === 'rm') return 'Release Manager';
  if (role === 'approver') return 'Aprobador';
  return 'Cliente Interno';
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) {
    return { user: null, deny: NextResponse.json({ ok: false, error: 'No autenticado' }, { status: 401 }) };
  }
  return { user, deny: null as NextResponse | null };
}

export async function requireRM() {
  const { user, deny } = await requireUser();
  if (deny) return { user: null, deny };
  if (roleOf(user) !== 'rm') {
    return { user: null, deny: NextResponse.json({ ok: false, error: 'Requiere rol Release Manager' }, { status: 403 }) };
  }
  return { user, deny: null as NextResponse | null };
}

export async function requireAnyRole(allowed: Role[]) {
  const { user, deny } = await requireUser();
  if (deny) return { user: null, deny };
  const role = roleOf(user);
  if (!allowed.includes(role)) {
    return { user: null, deny: NextResponse.json({ ok: false, error: 'No tienes permiso para esta acción' }, { status: 403 }) };
  }
  return { user, deny: null as NextResponse | null, role };
}
