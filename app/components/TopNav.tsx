'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createSupabaseBrowser } from '../../lib/supabase-browser';

type Role = 'client' | 'approver' | 'rm';

const CLIENT_LINKS = [
  { href: '/', label: 'Inicio' },
  { href: '/rdc', label: 'Nuevo RDC' },
  { href: '/mis-cambios', label: 'Mis Cambios' },
];

const APPROVER_LINKS = [
  { href: '/', label: 'Inicio' },
  { href: '/mis-aprobaciones', label: 'Mis Aprobaciones' },
];

const RM_LINKS = [
  { href: '/', label: 'Inicio' },
  { href: '/rdc', label: 'Nuevo RDC' },
  { href: '/mis-cambios', label: 'Mis Cambios' },
  { href: '/release', label: 'Release' },
  { href: '/approvals', label: 'Aprobaciones' },
  { href: '/cab', label: 'Agenda CAB' },
  { href: '/pap', label: 'Plan PAP' },
  { href: '/cierre', label: 'Cierre' },
  { href: '/dashboard', label: 'Dashboard DORA' },
];

const ROLE_LABEL: Record<Role, string> = {
  client: 'Cliente Interno',
  approver: 'Aprobador',
  rm: 'Release Manager',
};

export default function TopNav({ role, email }: { role: Role; email: string }) {
  const pathname = usePathname() || '/';
  const router = useRouter();

  const links = role === 'rm' ? RM_LINKS : role === 'approver' ? APPROVER_LINKS : CLIENT_LINKS;

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
          const rm = ['/release', '/approvals', '/cab', '/pap', '/cierre', '/dashboard'].includes(l.href);
          return (
            <Link key={l.href} href={l.href} className={`${isActive(l.href) ? 'active' : ''} ${rm ? 'rm' : ''}`}>
              {l.label}
            </Link>
          );
        })}
      </nav>

      <div className="nav-right">
        <span className={`nav-role ${role}`}>{ROLE_LABEL[role]}</span>
        {email ? <span className="nav-email" title={email}>{email}</span> : null}
        <button className="nav-logout" onClick={logout}>Salir</button>
      </div>
    </header>
  );
}
