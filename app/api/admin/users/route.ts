import { NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase-admin';
import { requireSuperAdmin } from '@/lib/auth';
import { APP_MODULES, APP_ACTIONS, modulesForRole, actionsForRole, normalizeAppRole } from '@/lib/permissions';
import { normalizeEmail, displayNameFromEmail } from '@/lib/utils';

export const dynamic = 'force-dynamic';

async function hydrateUsersWithPermissions(supabase: any, users: any[]) {
  const ids = users.map((user) => user.id).filter(Boolean);
  if (!ids.length) return users;

  const [{ data: moduleRows }, { data: actionRows }] = await Promise.all([
    supabase.from('user_module_permissions').select('user_id, module_key, can_view').in('user_id', ids),
    supabase.from('user_action_permissions').select('user_id, permission_key, allowed').in('user_id', ids),
  ]);

  return users.map((user) => ({
    ...user,
    modulePermissions: (moduleRows || []).filter((row: any) => row.user_id === user.id),
    actionPermissions: (actionRows || []).filter((row: any) => row.user_id === user.id),
  }));
}

async function upsertUserByEmail(supabase: any, payload: any) {
  const email = normalizeEmail(payload.email);
  const role = normalizeAppRole(payload.role);
  const fullName = String(payload.full_name || payload.fullName || displayNameFromEmail(email)).trim();

  const { data: existing } = await supabase.from('app_users').select('*').eq('email', email).maybeSingle();
  if (existing?.id) {
    const { data, error } = await supabase
      .from('app_users')
      .update({ full_name: fullName, role, is_active: payload.is_active !== false, updated_at: new Date().toISOString() })
      .eq('id', existing.id)
      .select('*')
      .single();
    return { data, error };
  }

  const { data, error } = await supabase
    .from('app_users')
    .insert({ email, full_name: fullName, role, is_active: payload.is_active !== false })
    .select('*')
    .single();

  return { data, error };
}

export async function GET(req: Request) {
  try {
    const { deny } = await requireSuperAdmin();
    if (deny) return deny;

    const { searchParams } = new URL(req.url);
    const q = normalizeEmail(searchParams.get('q'));
    const supabase = createSupabaseAdmin();

    let query = supabase.from('app_users').select('*').order('updated_at', { ascending: false }).limit(25);
    if (q) query = query.or(`email.ilike.%${q}%,full_name.ilike.%${q}%`);

    const { data: appUsers, error } = await query;
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

    let authUsers: any[] = [];
    if (q) {
      const { data } = await supabase.auth.admin.listUsers({ page: 1, perPage: 100 });
      authUsers = (data?.users || [])
        .filter((item: any) => normalizeEmail(item.email).includes(q))
        .map((item: any) => ({
          id: null,
          auth_user_id: item.id,
          email: normalizeEmail(item.email),
          full_name: item.user_metadata?.full_name || displayNameFromEmail(item.email || ''),
          role: normalizeAppRole(item.app_metadata?.role || item.user_metadata?.role),
          is_active: true,
          source: 'auth',
        }));
    }

    const merged = new Map<string, any>();
    (authUsers || []).forEach((user) => merged.set(user.email, user));
    (appUsers || []).forEach((user: any) => merged.set(user.email, { ...user, source: 'app_users' }));

    const users = await hydrateUsersWithPermissions(supabase, Array.from(merged.values()));
    return NextResponse.json({ ok: true, users });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message || 'Error consultando usuarios' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { user: adminUser, deny } = await requireSuperAdmin();
    if (deny) return deny;

    const body = await req.json().catch(() => ({}));
    const email = normalizeEmail(body.email);
    if (!email) return NextResponse.json({ ok: false, error: 'Correo requerido' }, { status: 400 });

    const supabase = createSupabaseAdmin();
    const { data: appUser, error: userError } = await upsertUserByEmail(supabase, body);
    if (userError || !appUser) {
      return NextResponse.json({ ok: false, error: userError?.message || 'No fue posible guardar usuario' }, { status: 500 });
    }

    const modulePermissions = Array.isArray(body.modulePermissions) ? body.modulePermissions : [];
    const actionPermissions = Array.isArray(body.actionPermissions) ? body.actionPermissions : [];

    await supabase.from('user_module_permissions').delete().eq('user_id', appUser.id);
    if (modulePermissions.length) {
      const rows = modulePermissions
        .filter((item: any) => APP_MODULES.some((module) => module.key === item.module_key) && item.can_view === true)
        .map((item: any) => ({ user_id: appUser.id, module_key: item.module_key, can_view: true }));
      if (rows.length) {
        const { error } = await supabase.from('user_module_permissions').insert(rows);
        if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
      }
    }

    await supabase.from('user_action_permissions').delete().eq('user_id', appUser.id);
    if (actionPermissions.length) {
      const rows = actionPermissions
        .filter((item: any) => APP_ACTIONS.some((action) => action.key === item.permission_key) && item.allowed === true)
        .map((item: any) => ({ user_id: appUser.id, permission_key: item.permission_key, allowed: true }));
      if (rows.length) {
        const { error } = await supabase.from('user_action_permissions').insert(rows);
        if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
      }
    }

    await supabase.from('permission_audit_log').insert({
      target_user_id: appUser.id,
      changed_by_email: adminUser?.email || null,
      action: 'UPSERT_USER_PERMISSIONS',
      payload: body,
    });

    const { data: savedModulePermissions } = await supabase
      .from('user_module_permissions')
      .select('module_key, can_view')
      .eq('user_id', appUser.id);

    const { data: savedActionPermissions } = await supabase
      .from('user_action_permissions')
      .select('permission_key, allowed')
      .eq('user_id', appUser.id);

    const effectiveRole = normalizeAppRole(appUser.role);
    return NextResponse.json({
      ok: true,
      user: appUser,
      modulePermissions: savedModulePermissions || [],
      actionPermissions: savedActionPermissions || [],
      defaultModules: modulesForRole(effectiveRole),
      defaultActions: actionsForRole(effectiveRole),
    });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message || 'Error guardando permisos' }, { status: 500 });
  }
}
