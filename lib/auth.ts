import { NextResponse } from 'next/server';
import { createSupabaseServer } from './supabase-server';
import { createSupabaseAdmin } from './supabase-admin';
import { actionsForRole, normalizeAppRole, type AppRole } from './permissions';
import { normalizeEmail, isTableMissing } from './utils';
import { roleOf as baseRoleOf, type Role } from './roles';

export { roleLabel, type Role } from './roles';
export { normalizeEmail } from './utils';

// getUser() valida el JWT contra el servidor de Supabase.
export async function getCurrentUser() {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export function isSuperAdminEmail(email?: string | null): boolean {
  const normalized = normalizeEmail(email);
  if (!normalized) return false;

  const configured = String(process.env.SUPER_ADMIN_EMAILS || '')
    .split(',')
    .map((item) => normalizeEmail(item))
    .filter(Boolean);

  return configured.includes(normalized);
}

/**
 * Determina el rol del usuario. Extiende la lógica base con
 * la verificación de super admin por email (solo disponible en Node runtime).
 */
export function roleOf(user: any): Role {
  const base = baseRoleOf(user);
  if (base === 'client' && isSuperAdminEmail(user?.email)) return 'super_admin';
  return base;
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) {
    return { user: null, deny: NextResponse.json({ ok: false, error: 'No autenticado' }, { status: 401 }) };
  }
  return { user, deny: null as NextResponse | null };
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

    // Verificar si el usuario tiene permisos custom guardados
    const { data: allRows, error: permError } = await supabase
      .from('user_action_permissions')
      .select('permission_key, allowed')
      .eq('user_id', appUser.id);

    if (permError && isTableMissing(permError)) return defaultAllowed.has(permissionKey);

    const customRows = Array.isArray(allRows) ? allRows : [];

    // Si tiene permisos custom, solo esos aplican
    if (customRows.length > 0) {
      return customRows.some((row) => row.permission_key === permissionKey && row.allowed === true);
    }

    // Sin custom, usar defaults del rol
    return defaultAllowed.has(permissionKey);
  } catch {
    return defaultAllowed.has(permissionKey);
  }
}

export async function requireDeployAccess() {
  const { user, deny } = await requireUser();
  if (deny) return { user: null, deny };

  const role = await getEffectiveAppRole(user);

  // Super admin siempre pasa
  if (role === 'super_admin') {
    return { user, deny: null as NextResponse | null, role };
  }

  // Para otros roles, verificar permisos de acción específicos
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
  if (role === 'super_admin' || allowed.includes(role as Role)) {
    return { user, deny: null as NextResponse | null, role };
  }
  return { user: null, deny: NextResponse.json({ ok: false, error: 'No tienes permiso para esta acción' }, { status: 403 }) };
}

/**
 * Verifica si el usuario tiene acceso a un módulo específico.
 * Consulta permisos custom de la BD. Si no tiene custom, usa defaults del rol.
 * Esto unifica la visibilidad del sidebar con el acceso real a la API.
 */
export async function requireModuleAccess(moduleKey: string) {
  const { user, deny } = await requireUser();
  if (deny) return { user: null, deny };

  const role = await getEffectiveAppRole(user);

  // Super admin siempre pasa
  if (role === 'super_admin') {
    return { user, deny: null as NextResponse | null, role };
  }

  const email = normalizeEmail(user?.email);
  if (!email) {
    return { user: null, deny: NextResponse.json({ ok: false, error: 'No tienes permiso para este módulo' }, { status: 403 }) };
  }

  try {
    const supabase = createSupabaseAdmin();

    const { data: appUser, error: userError } = await supabase
      .from('app_users')
      .select('id, role, is_active')
      .eq('email', email)
      .maybeSingle();

    if (userError && isTableMissing(userError)) {
      // Sin tabla, usar defaults del rol
      const { ROLE_DEFAULT_MODULES } = await import('./permissions');
      const defaults = ROLE_DEFAULT_MODULES[role] || [];
      if (defaults.includes(moduleKey)) return { user, deny: null as NextResponse | null, role };
      return { user: null, deny: NextResponse.json({ ok: false, error: 'No tienes permiso para este módulo' }, { status: 403 }) };
    }

    if (userError || !appUser || appUser.is_active === false) {
      // Sin usuario en BD, usar defaults del rol
      const { ROLE_DEFAULT_MODULES } = await import('./permissions');
      const defaults = ROLE_DEFAULT_MODULES[role] || [];
      if (defaults.includes(moduleKey)) return { user, deny: null as NextResponse | null, role };
      return { user: null, deny: NextResponse.json({ ok: false, error: 'No tienes permiso para este módulo' }, { status: 403 }) };
    }

    // Verificar permisos custom
    const { data: modulePerms } = await supabase
      .from('user_module_permissions')
      .select('module_key, can_view')
      .eq('user_id', appUser.id);

    const customRows = Array.isArray(modulePerms) ? modulePerms : [];

    if (customRows.length > 0) {
      // Tiene custom: solo esos aplican
      const hasAccess = customRows.some((row) => row.module_key === moduleKey && row.can_view === true);
      if (hasAccess) return { user, deny: null as NextResponse | null, role };
      return { user: null, deny: NextResponse.json({ ok: false, error: 'No tienes permiso para este módulo' }, { status: 403 }) };
    }

    // Sin custom: usar defaults del rol
    const { ROLE_DEFAULT_MODULES } = await import('./permissions');
    const defaults = ROLE_DEFAULT_MODULES[role] || [];
    if (defaults.includes(moduleKey)) return { user, deny: null as NextResponse | null, role };

    return { user: null, deny: NextResponse.json({ ok: false, error: 'No tienes permiso para este módulo' }, { status: 403 }) };
  } catch {
    // En caso de error, fallback a defaults del rol
    const { ROLE_DEFAULT_MODULES } = await import('./permissions');
    const defaults = ROLE_DEFAULT_MODULES[role] || [];
    if (defaults.includes(moduleKey)) return { user, deny: null as NextResponse | null, role };
    return { user: null, deny: NextResponse.json({ ok: false, error: 'No tienes permiso para este módulo' }, { status: 403 }) };
  }
}
