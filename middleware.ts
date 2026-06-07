import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

type AppRole = 'client' | 'approver' | 'deployment' | 'rm' | 'super_admin' | 'read_only';

const PUBLIC_APPROVE_PREFIXES = ['/approve'];

const ROLE_ROUTE_PREFIXES: Record<AppRole, string[]> = {
  client: ['/', '/rdc', '/mis-cambios'],
  approver: ['/', '/mis-aprobaciones'],
  deployment: ['/', '/mis-aprobaciones', '/pap', '/deploy', '/cierre'],
  rm: ['/', '/rdc', '/mis-cambios', '/release', '/approvals', '/cab', '/pap', '/deploy', '/cierre', '/dashboard'],
  super_admin: ['/', '/rdc', '/mis-cambios', '/release', '/approvals', '/cab', '/pap', '/deploy', '/cierre', '/dashboard', '/admin'],
  read_only: ['/', '/mis-cambios', '/dashboard'],
};

function normalizeEmail(value?: string | null) {
  return String(value || '').trim().toLowerCase();
}

function normalizeRole(value?: string | null): AppRole {
  const raw = String(value || '').trim().toLowerCase();

  if (raw === 'super_admin' || raw === 'super-admin' || raw === 'superadmin' || raw === 'admin') return 'super_admin';
  if (raw === 'rm' || raw === 'release_manager' || raw === 'release-manager') return 'rm';
  if (raw === 'deployment' || raw === 'deploy' || raw === 'implementador') return 'deployment';
  if (raw === 'approver' || raw === 'aprobador') return 'approver';
  if (raw === 'read_only' || raw === 'readonly' || raw === 'solo_lectura') return 'read_only';

  return 'client';
}

function isSuperAdminEmail(email?: string | null) {
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

function isDeploymentEmail(email?: string | null) {
  const normalized = normalizeEmail(email);
  const configured = String(process.env.NEXT_PUBLIC_DEPLOYMENT_APPROVERS || process.env.DEPLOYMENT_APPROVERS || '')
    .split(',')
    .map((item) => normalizeEmail(item))
    .filter(Boolean);

  return configured.includes(normalized)
    || normalized === 'ximena.cruz@klap.cl'
    || normalized.includes('ximena.cruz');
}

function fallbackRoleOf(user: any): AppRole {
  const email = normalizeEmail(user?.email);
  const raw = String(user?.app_metadata?.role || user?.user_metadata?.role || '').toLowerCase();

  if (isSuperAdminEmail(email)) return 'super_admin';
  if (isDeploymentEmail(email)) return 'deployment';

  return normalizeRole(raw);
}

function matchPrefix(pathname: string, prefixes: string[]) {
  return prefixes.some((p) => pathname === p || pathname.startsWith(p + '/'));
}

function defaultLanding(role: AppRole) {
  if (role === 'approver' || role === 'deployment') return '/mis-aprobaciones';
  if (role === 'super_admin' || role === 'rm') return '/';
  return '/';
}

async function effectiveRoleFromDb(supabase: any, user: any): Promise<AppRole> {
  const fallback = fallbackRoleOf(user);
  const email = normalizeEmail(user?.email);

  if (!email) return fallback;

  try {
    const { data, error } = await supabase
      .from('app_users')
      .select('role, is_active')
      .eq('email', email)
      .maybeSingle();

    if (error || !data || data.is_active === false) return fallback;

    return normalizeRole(data.role || fallback);
  } catch {
    return fallback;
  }
}

async function modulesFromDb(supabase: any, user: any, role: AppRole) {
  const defaultPrefixes = ROLE_ROUTE_PREFIXES[role] || ROLE_ROUTE_PREFIXES.client;
  const email = normalizeEmail(user?.email);

  if (!email) return defaultPrefixes;

  try {
    const { data: appUser, error: userError } = await supabase
      .from('app_users')
      .select('id')
      .eq('email', email)
      .maybeSingle();

    if (userError || !appUser?.id) return defaultPrefixes;

    const { data: permissions } = await supabase
      .from('user_module_permissions')
      .select('module_key, can_view, app_modules(path)')
      .eq('user_id', appUser.id);

    if (!Array.isArray(permissions) || !permissions.length) return defaultPrefixes;

    const allowedPaths = permissions
      .filter((row: any) => row.can_view === true && row.app_modules?.path)
      .map((row: any) => row.app_modules.path);

    if (!allowedPaths.length) return defaultPrefixes;

    return Array.from(new Set(['/', ...allowedPaths]));
  } catch {
    return defaultPrefixes;
  }
}

export async function middleware(req: NextRequest) {
  let res = NextResponse.next({ request: req });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => req.cookies.set(name, value));
          res = NextResponse.next({ request: req });
          cookiesToSet.forEach(({ name, value, options }) => res.cookies.set(name, value, options));
        },
      },
    },
  );

  const { data: { user } } = await supabase.auth.getUser();
  const { pathname } = req.nextUrl;
  const onLogin = pathname === '/login';

  if (matchPrefix(pathname, PUBLIC_APPROVE_PREFIXES)) return res;

  if (!user && !onLogin) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    url.search = `?next=${encodeURIComponent(pathname)}`;
    return NextResponse.redirect(url);
  }

  if (!user) return res;

  const role = await effectiveRoleFromDb(supabase, user);

  if (onLogin) {
    const url = req.nextUrl.clone();
    url.pathname = defaultLanding(role);
    url.search = '';
    return NextResponse.redirect(url);
  }

  const allowedPrefixes = await modulesFromDb(supabase, user, role);
  const allowed = matchPrefix(pathname, allowedPrefixes);

  if (!allowed) {
    const url = req.nextUrl.clone();
    url.pathname = defaultLanding(role);
    url.search = '';
    return NextResponse.redirect(url);
  }

  return res;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api|approve|.*\\..*).*)'],
};
