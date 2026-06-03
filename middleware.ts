import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

const RM_PREFIXES = ['/release', '/approvals', '/cab', '/dashboard'];

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

  // Refresca y valida la sesión.
  const { data: { user } } = await supabase.auth.getUser();
  const { pathname } = req.nextUrl;
  const onLogin = pathname === '/login';

  // Sin sesión -> al login (guardando a dónde quería ir).
  if (!user && !onLogin) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    url.search = `?next=${encodeURIComponent(pathname)}`;
    return NextResponse.redirect(url);
  }

  // Con sesión y en /login -> al home.
  if (user && onLogin) {
    const url = req.nextUrl.clone();
    url.pathname = '/';
    url.search = '';
    return NextResponse.redirect(url);
  }

  // Rutas de Release Manager: requieren rol rm.
  if (user) {
    const isRM = RM_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + '/'));
    const role = (user.app_metadata as any)?.role === 'rm' ? 'rm' : 'user';
    if (isRM && role !== 'rm') {
      const url = req.nextUrl.clone();
      url.pathname = '/';
      url.search = '';
      return NextResponse.redirect(url);
    }
  }

  return res;
}

// Corre en páginas. Excluye estáticos, /api (protegidas en cada handler) y
// /approve (flujo de aprobador externo por token, sin login).
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api|approve|.*\\..*).*)'],
};
