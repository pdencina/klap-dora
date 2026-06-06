'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { createSupabaseBrowser } from '../../lib/supabase-browser';

type Role = 'client' | 'approver' | 'rm';

type NavLink = {
  href: string;
  label: string;
  icon: string;
  rm?: boolean;
};

const CLIENT_LINKS: NavLink[] = [
  { href: '/', label: 'Inicio', icon: '⌂' },
  { href: '/rdc', label: 'Nuevo RDC', icon: '＋' },
  { href: '/mis-cambios', label: 'Mis Cambios', icon: '◇' },
];

const APPROVER_LINKS: NavLink[] = [
  { href: '/', label: 'Inicio', icon: '⌂' },
  { href: '/mis-aprobaciones', label: 'Mis Aprobaciones', icon: '✓' },
];

const RM_LINKS: NavLink[] = [
  { href: '/', label: 'Inicio', icon: '⌂' },
  { href: '/rdc', label: 'Nuevo RDC', icon: '＋' },
  { href: '/mis-cambios', label: 'Mis Cambios', icon: '◇' },
  { href: '/release', label: 'Release', icon: '○', rm: true },
  { href: '/approvals', label: 'Aprobaciones', icon: '✓', rm: true },
  { href: '/cab', label: 'Agenda CAB', icon: '▣', rm: true },
  { href: '/pap', label: 'Plan PAP', icon: '□', rm: true },
  { href: '/deploy', label: 'Deploy Center', icon: '↗', rm: true },
  { href: '/cierre', label: 'Cierre', icon: '⚑', rm: true },
  { href: '/dashboard', label: 'Dashboard DORA', icon: '⌁', rm: true },
];

const ROLE_LABEL: Record<Role, string> = {
  client: 'Cliente Interno',
  approver: 'Aprobador',
  rm: 'Release Manager',
};

export default function TopNav({ role, email }: { role: Role; email: string }) {
  const pathname = usePathname() || '/';
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);

  const links = role === 'rm' ? RM_LINKS : role === 'approver' ? APPROVER_LINKS : CLIENT_LINKS;

  const isActive = (href: string) => (href === '/' ? pathname === '/' : pathname.startsWith(href));

  useEffect(() => {
    document.body.classList.toggle('sidebar-collapsed', collapsed);
    return () => document.body.classList.remove('sidebar-collapsed');
  }, [collapsed]);

  async function logout() {
    const supabase = createSupabaseBrowser();
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  return (
    <aside className={collapsed ? 'app-sidebar is-collapsed' : 'app-sidebar'}>
      <div className="app-sidebar-top">
        <button
          className="app-sidebar-toggle"
          type="button"
          aria-label="Abrir o cerrar menú"
          onClick={() => setCollapsed((value) => !value)}
        >
          <span />
          <span />
          <span />
        </button>

        <Link href="/" className="app-sidebar-brand">
          <strong>klap</strong>
          <span>RELEASE</span>
        </Link>
      </div>

      <nav className="app-sidebar-nav" aria-label="Navegación principal">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={`app-sidebar-link ${isActive(link.href) ? 'active' : ''} ${link.rm ? 'rm' : ''}`}
          >
            <span className="app-sidebar-icon" aria-hidden="true">{link.icon}</span>
            <b>{link.label}</b>
          </Link>
        ))}
      </nav>

      <div className="app-sidebar-user">
        <div className="app-sidebar-avatar">PE</div>
        <div className="app-sidebar-user-text">
          <b>{email ? email.split('@')[0].replace('.', ' ') : 'Usuario'}</b>
          <span>{ROLE_LABEL[role]}</span>
        </div>
      </div>

      <button className="app-sidebar-logout" type="button" onClick={logout}>
        <span>Salir</span>
      </button>
    </aside>
  );
}
