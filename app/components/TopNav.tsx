'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createSupabaseBrowser } from '../../lib/supabase-browser';

type Role = 'user' | 'rm';

const USER_LINKS = [
  { href: '/', label: 'Inicio' },
  { href: '/rdc', label: 'Nuevo RDC' },
  { href: '/mis-cambios', label: 'Mis Cambios' },
];

const RM_LINKS = [
  { href: '/release', label: 'Release' },
  { href: '/approvals', label: 'Aprobaciones' },
  { href: '/cab', label: 'Agenda CAB' },
  { href: '/cierre', label: 'Cierre' },
  { href: '/dashboard', label: 'Dashboard DORA' },
];

export default function TopNav({ role, email }: { role: Role; email: string }) {
  const pathname = usePathname() || '/';
  const router = useRouter();
  const links = role === 'rm' ? [...USER_LINKS, ...RM_LINKS] : USER_LINKS;

  const isActive = (href: string) => (href === '/' ? pathname === '/' : pathname.startsWith(href));

  async function logout() {
    const supabase = createSupabaseBrowser();
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  return (
    <header className="nav">
      <Link href="/" className="nav-brand">
        <span className="word"><span className="k">k</span>lap</span>
        <em>Release</em>
      </Link>

      <nav className="nav-links" aria-label="Navegación principal">
        {links.map((l) => {
          const rm = RM_LINKS.some((r) => r.href === l.href);
          return (
            <Link key={l.href} href={l.href} className={`${isActive(l.href) ? 'active' : ''} ${rm ? 'rm' : ''}`}>
              {l.label}
            </Link>
          );
        })}
      </nav>

      <div className="nav-right">
        <span className={`nav-role ${role}`}>{role === 'rm' ? 'Release Manager' : 'Solicitante'}</span>
        {email ? <span className="nav-email" title={email}>{email}</span> : null}
        <button className="nav-logout" onClick={logout}>Salir</button>
      </div>
    </header>
  );
}
