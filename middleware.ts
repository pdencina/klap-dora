import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

const RM_PREFIXES = ['/release', '/approvals', '/cab', '/cierre', '/dashboard'];
const CLIENT_PREFIXES = ['/rdc', '/mis-cambios'];
const APPROVER_PREFIXES = ['/mis-aprobaciones'];

function roleOf(user: any): 'client' | 'approver' | 'rm' {
  const raw = String(user?.app_metadata?.role || user?.user_metadata?.role || '').toLowerCase();
  if (raw === 'rm' || raw === 'release_manager' || raw === 'release-manager') return 'rm';
  if (raw === 'approver' || raw === 'aprobador') return 'approver';
  return 'client';
}

function matchPrefix(pathname: string, prefixes: string[]) {
  return prefixes.some((p) => pathname === p || pathname.startsWith(p + '/'));
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

  if (!user && !onLogin) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    url.search = `?next=${encodeURIComponent(pathname)}`;
    return NextResponse.redirect(url);
  }

  if (user && onLogin) {
    const url = req.nextUrl.clone();
    url.pathname = '/';
    url.search = '';
    return NextResponse.redirect(url);
  }

  if (user) {
    const role = roleOf(user);

    // RM ve todo.
    if (role !== 'rm') {
      if (matchPrefix(pathname, RM_PREFIXES)) {
        const url = req.nextUrl.clone();
        url.pathname = '/';
        url.search = '';
        return NextResponse.redirect(url);
      }

      // Cliente interno puede crear/ver sus RDC. Aprobador no.
      if (matchPrefix(pathname, CLIENT_PREFIXES) && role !== 'client') {
        const url = req.nextUrl.clone();
        url.pathname = '/mis-aprobaciones';
        url.search = '';
        return NextResponse.redirect(url);
      }

      // Aprobador puede ver su bandeja. Cliente interno no.
      if (matchPrefix(pathname, APPROVER_PREFIXES) && role !== 'approver') {
        const url = req.nextUrl.clone();
        url.pathname = '/';
        url.search = '';
        return NextResponse.redirect(url);
      }
    }
  }

  return res;
}

// Excluye estáticos, /api y /approve.
// /approve sigue funcionando por token, incluso sin login.
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api|approve|.*\\..*).*)'],
};
