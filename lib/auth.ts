import { NextResponse } from 'next/server';
import { createSupabaseServer } from './supabase-server';
import { createSupabaseAdmin } from './supabase-admin';
import { actionsForRole, normalizeAppRole, type AppRole } from './permissions';

export type Role = 'client' | 'approver' | 'deployment' | 'rm' | 'super_admin' | 'read_only';

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
  if (raw === 'deployment' || raw === 'deploy' || raw === 'implementador') return 'deployment';
  if (raw === 'approver' || raw === 'aprobador') return 'approver';

  // Compatibilidad con usuarios antiguos: antes el rol por defecto era "user".
  return 'client';
}

export function roleLabel(role: Role) {
  if (role === 'super_admin') return 'Super Admin';
  if (role === 'rm') return 'Release Manager';
  if (role === 'deployment') return 'Deployment';
  if (role === 'approver') return 'Aprobador';
  if (role === 'read_only') return 'Solo Lectura';
  return 'Cliente Interno';
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) {
    return { user: null, deny: NextResponse.json({ ok: false, error: 'No autenticado' }, { status: 401 }) };
  }
  return { user, deny: null as NextResponse | null };
}


function isTableMissing(error: any) {
  const message = String(error?.message || error?.details || '').toLowerCase();
  return message.includes('does not exist') || message.includes('schema cache') || message.includes('relation');
}

export async function getEffectiveAppRole(user: any): Promise<AppRole> {
  const fallback = normalizeAppRole(roleOf(user));
  const email = normalizeEmail(user?.email);

  if (!email) return fallback;

  try {
    const supabase = createSupabaseAdmin();
    const { data, error } = await supabase
      .from('app_users')
      .select('role, is_active')
      .eq('email', email)
      .maybeSingle();

    if (error && isTableMissing(error)) return fallback;
    if (error || !data || data.is_active === false) return fallback;

    return normalizeAppRole(data.role || fallback);
  } catch {
    return fallback;
  }
}

export async function hasActionPermission(user: any, permissionKey: string) {
  const email = normalizeEmail(user?.email);
  const effectiveRole = await getEffectiveAppRole(user);

  if (effectiveRole === 'super_admin') return true;

  const defaultAllowed = new Set(actionsForRole(effectiveRole).map((action) => action.key));

  if (!email) return defaultAllowed.has(permissionKey);

  try {
    const supabase = createSupabaseAdmin();

    const { data: appUser, error: userError } = await supabase
      .from('app_users')
      .select('id, role, is_active')
      .eq('email', email)
      .maybeSingle();

    if (userError && isTableMissing(userError)) return defaultAllowed.has(permissionKey);
    if (userError || !appUser || appUser.is_active === false) return defaultAllowed.has(permissionKey);

    const { data: row } = await supabase
      .from('user_action_permissions')
      .select('allowed')
      .eq('user_id', appUser.id)
      .eq('permission_key', permissionKey)
      .maybeSingle();

    if (row && typeof row.allowed === 'boolean') return row.allowed;

    return defaultAllowed.has(permissionKey);
  } catch {
    return defaultAllowed.has(permissionKey);
  }
}

export async function requireDeployAccess() {
  const { user, deny } = await requireUser();
  if (deny) return { user: null, deny };

  const role = await getEffectiveAppRole(user);

  if (role === 'super_admin' || role === 'rm' || role === 'deployment') {
    return { user, deny: null as NextResponse | null, role };
  }

  const allowed =
    await hasActionPermission(user, 'execute_jenkins') ||
    await hasActionPermission(user, 'update_jenkins_status');

  if (!allowed) {
    return {
      user: null,
      deny: NextResponse.json({ ok: false, error: 'No tienes permiso para acceder a Deploy Center' }, { status: 403 }),
      role,
    };
  }

  return { user, deny: null as NextResponse | null, role };
}

export async function requireActionPermission(permissionKey: string) {
  const { user, deny } = await requireUser();
  if (deny) return { user: null, deny };

  const allowed = await hasActionPermission(user, permissionKey);

  if (!allowed) {
    return {
      user: null,
      deny: NextResponse.json({ ok: false, error: 'No tienes permiso para esta acción' }, { status: 403 }),
    };
  }

  return { user, deny: null as NextResponse | null };
}

export async function requireRM() {
  const { user, deny } = await requireUser();
  if (deny) return { user: null, deny };
  const role = await getEffectiveAppRole(user);
  if (role !== 'rm' && role !== 'super_admin') {
    return { user: null, deny: NextResponse.json({ ok: false, error: 'Requiere rol Release Manager' }, { status: 403 }) };
  }
  return { user, deny: null as NextResponse | null };
}

export async function requireSuperAdmin() {
  const { user, deny } = await requireUser();
  if (deny) return { user: null, deny };
  if ((await getEffectiveAppRole(user)) !== 'super_admin') {
    return { user: null, deny: NextResponse.json({ ok: false, error: 'Requiere rol Super Admin' }, { status: 403 }) };
  }
  return { user, deny: null as NextResponse | null };
}

export async function requireAnyRole(allowed: Role[]) {
  const { user, deny } = await requireUser();
  if (deny) return { user: null, deny };
  const role = await getEffectiveAppRole(user);
  if (!allowed.includes(role as Role)) {
    return { user: null, deny: NextResponse.json({ ok: false, error: 'No tienes permiso para esta acción' }, { status: 403 }) };
  }
  return { user, deny: null as NextResponse | null, role };
}
