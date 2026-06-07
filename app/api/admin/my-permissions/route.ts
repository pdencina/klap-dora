import { NextResponse } from 'next/server';
import { createSupabaseAdmin } from '../../../../lib/supabase-admin';
import { requireUser, roleOf } from '../../../../lib/auth';
import { APP_MODULES, APP_ACTIONS, modulesForRole, actionsForRole, normalizeAppRole } from '../../../../lib/permissions';

export const dynamic = 'force-dynamic';

function normalizeEmail(value?: string | null) {
  return String(value || '').trim().toLowerCase();
}

function isTableMissing(error: any) {
  const message = String(error?.message || '').toLowerCase();
  return message.includes('does not exist') || message.includes('schema cache') || message.includes('relation');
}

export async function GET() {
  try {
    const { user, deny } = await requireUser();
    if (deny) return deny;

    const fallbackRole = normalizeAppRole(roleOf(user));
    const email = normalizeEmail(user?.email);
    const supabase = createSupabaseAdmin();

    const { data: appUser, error: userError } = await supabase
      .from('app_users')
      .select('*')
      .eq('email', email)
      .maybeSingle();

    if (userError && !isTableMissing(userError)) {
      return NextResponse.json({ ok: false, error: userError.message }, { status: 500 });
    }

    if (userError && isTableMissing(userError)) {
      return NextResponse.json({
        ok: true,
        source: 'fallback',
        role: fallbackRole,
        modules: modulesForRole(fallbackRole),
        actions: actionsForRole(fallbackRole),
      });
    }

    const effectiveRole = normalizeAppRole(appUser?.role || fallbackRole);

    const { data: modulePermissions } = appUser?.id
      ? await supabase.from('user_module_permissions').select('module_key, can_view').eq('user_id', appUser.id)
      : { data: null } as any;

    const { data: actionPermissions } = appUser?.id
      ? await supabase.from('user_action_permissions').select('permission_key, allowed').eq('user_id', appUser.id)
      : { data: null } as any;

    const defaultModuleKeys = new Set(modulesForRole(effectiveRole).map((module) => module.key));
    const customModuleRows = Array.isArray(modulePermissions) ? modulePermissions : [];
    const denied = new Set(customModuleRows.filter((item: any) => item.can_view === false).map((item: any) => item.module_key));
    const allowed = new Set(customModuleRows.filter((item: any) => item.can_view === true).map((item: any) => item.module_key));

    const modules = APP_MODULES
      .filter((module) => (allowed.has(module.key) || defaultModuleKeys.has(module.key)) && !denied.has(module.key))
      .sort((a, b) => a.sort_order - b.sort_order);

    const defaultActionKeys = new Set(actionsForRole(effectiveRole).map((action) => action.key));
    const customActionRows = Array.isArray(actionPermissions) ? actionPermissions : [];
    const deniedActions = new Set(customActionRows.filter((item: any) => item.allowed === false).map((item: any) => item.permission_key));
    const allowedActions = new Set(customActionRows.filter((item: any) => item.allowed === true).map((item: any) => item.permission_key));

    const actions = APP_ACTIONS
      .filter((action) => (allowedActions.has(action.key) || defaultActionKeys.has(action.key)) && !deniedActions.has(action.key));

    return NextResponse.json({ ok: true, source: 'database', role: effectiveRole, modules, actions });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message || 'Error consultando permisos' }, { status: 500 });
  }
}
