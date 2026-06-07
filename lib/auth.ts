import { NextResponse } from 'next/server';
import { createSupabaseServer } from './supabase-server';

export type Role = 'client' | 'approver' | 'rm' | 'super_admin';

// getUser() valida el JWT contra el servidor de Supabase.
export async function getCurrentUser() {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

function normalizeEmail(value?: string | null) {
  return String(value || '').trim().toLowerCase();
}

export function isSuperAdminEmail(email?: string | null) {
  const normalized = normalizeEmail(email);
  const configured = String(process.env.SUPER_ADMIN_EMAILS || process.env.NEXT_PUBLIC_SUPER_ADMIN_EMAILS || '')
    .split(',')
    .map((item) => normalizeEmail(item))
    .filter(Boolean);

  return configured.includes(normalized)
    || normalized === 'encinaacevedo.pablo@gmail.com'
    || normalized === 'pablo.encina@klap.cl'
    || normalized === 'pablo.encinaacevedo@klap.cl';
}

export function roleOf(user: any): Role {
  const raw = String(user?.app_metadata?.role || user?.user_metadata?.role || '').toLowerCase();

  if (raw === 'super_admin' || raw === 'super-admin' || raw === 'admin' || raw === 'superadmin') return 'super_admin';
  if (isSuperAdminEmail(user?.email)) return 'super_admin';
  if (raw === 'rm' || raw === 'release_manager' || raw === 'release-manager') return 'rm';
  if (raw === 'approver' || raw === 'aprobador') return 'approver';

  // Compatibilidad con usuarios antiguos: antes el rol por defecto era "user".
  return 'client';
}

export function roleLabel(role: Role) {
  if (role === 'super_admin') return 'Super Admin';
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
  const role = roleOf(user);
  if (role !== 'rm' && role !== 'super_admin') {
    return { user: null, deny: NextResponse.json({ ok: false, error: 'Requiere rol Release Manager' }, { status: 403 }) };
  }
  return { user, deny: null as NextResponse | null };
}

export async function requireSuperAdmin() {
  const { user, deny } = await requireUser();
  if (deny) return { user: null, deny };
  if (roleOf(user) !== 'super_admin') {
    return { user: null, deny: NextResponse.json({ ok: false, error: 'Requiere rol Super Admin' }, { status: 403 }) };
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
