'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { createSupabaseBrowser } from '../../lib/supabase-browser';

type Role = 'client' | 'approver' | 'deployment' | 'rm' | 'super_admin' | 'read_only';

type NavLink = {
  href: string;
  label: string;
  icon: string;
  rm?: boolean;
  section?: 'OPERACIÓN' | 'CONTROL' | 'EJECUCIÓN' | 'MÉTRICAS' | 'ADMINISTRACIÓN';
};

const CLIENT_LINKS: NavLink[] = [
  { href: '/', label: 'Inicio', icon: '⌂' },
  { href: '/rdc', label: 'Nuevo RDC', icon: '＋', section: 'OPERACIÓN' },
  { href: '/mis-cambios', label: 'Mis Cambios', icon: '◇', section: 'OPERACIÓN' },
];

const APPROVER_LINKS: NavLink[] = [
  { href: '/', label: 'Inicio', icon: '⌂' },
  { href: '/mis-aprobaciones', label: 'Mis Aprobaciones', icon: '✓', section: 'CONTROL' },
];

const DEPLOYMENT_LINKS: NavLink[] = [
  { href: '/', label: 'Inicio', icon: '⌂' },
  { href: '/mis-aprobaciones', label: 'Mis Aprobaciones', icon: '✓', section: 'CONTROL' },
  { href: '/pap', label: 'Plan PAP', icon: '□', section: 'EJECUCIÓN' },
  { href: '/deploy', label: 'Deploy Center', icon: '↗', section: 'EJECUCIÓN' },
  { href: '/cierre', label: 'Cierre técnico', icon: '⚑', section: 'EJECUCIÓN' },
];

const RM_LINKS: NavLink[] = [
  { href: '/', label: 'Inicio', icon: '⌂' },

  { href: '/rdc', label: 'Nuevo RDC', icon: '＋', section: 'OPERACIÓN' },
  { href: '/mis-cambios', label: 'Mis Cambios', icon: '◇', section: 'OPERACIÓN' },
  { href: '/release', label: 'Release', icon: '○', rm: true, section: 'OPERACIÓN' },

  { href: '/approvals', label: 'Aprobaciones', icon: '✓', rm: true, section: 'CONTROL' },
  { href: '/cab', label: 'Agenda CAB', icon: '▣', rm: true, section: 'CONTROL' },

  { href: '/pap', label: 'Plan PAP', icon: '□', rm: true, section: 'EJECUCIÓN' },
  { href: '/deploy', label: 'Deploy Center', icon: '↗', rm: true, section: 'EJECUCIÓN' },
  { href: '/cierre', label: 'Cierre', icon: '⚑', rm: true, section: 'EJECUCIÓN' },

  { href: '/dashboard', label: 'Dashboard DORA', icon: '⌁', rm: true, section: 'MÉTRICAS' },

  { href: '/admin/users', label: 'Usuarios y permisos', icon: '⚙', rm: true, section: 'ADMINISTRACIÓN' },
];

const ROLE_LABEL: Record<Role, string> = {
  client: 'Cliente Interno',
  approver: 'Aprobador',
  deployment: 'Deployment',
  rm: 'Release Manager',
  super_admin: 'Super Admin',
  read_only: 'Solo Lectura',
};

function normalizeEmail(value: string) {
  return String(value || '').trim().toLowerCase();
}

function isDeploymentApproverEmail(email: string) {
  const normalized = normalizeEmail(email);

  const configuredEmails = String(process.env.NEXT_PUBLIC_DEPLOYMENT_APPROVERS || '')
    .split(',')
    .map((item) => normalizeEmail(item))
    .filter(Boolean);

  return configuredEmails.includes(normalized)
    || normalized === 'ximena.cruz@klap.cl'
    || normalized.includes('ximena.cruz');
}

export default function TopNav({ role, email }: { role: Role; email: string }) {
  const pathname = usePathname() || '/';
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);

  const isDeploymentApprover = role === 'approver' && isDeploymentApproverEmail(email);
  const links = role === 'super_admin'
    ? RM_LINKS
    : role === 'rm'
      ? RM_LINKS.filter((link) => link.section !== 'ADMINISTRACIÓN')
      : role === 'deployment' || isDeploymentApprover
        ? DEPLOYMENT_LINKS
        : role === 'approver'
          ? APPROVER_LINKS
          : CLIENT_LINKS;
  const displayRoleLabel = role === 'deployment' || isDeploymentApprover ? 'Deployment' : ROLE_LABEL[role];

  const isActive = (href: string) => (href === '/' ? pathname === '/' : pathname.startsWith(href));

  function renderSidebarLinks() {
    const home = links.find((link) => link.href === '/');
    const sectionNames = Array.from(
      new Set(links.map((link) => link.section).filter(Boolean)),
    ) as Array<NonNullable<NavLink['section']>>;

    return (
      <>
        {home ? (
          <Link
            key={home.href}
            href={home.href}
            className={`app-sidebar-link ${isActive(home.href) ? 'active' : ''}`}
          >
            <span className="app-sidebar-icon" aria-hidden="true">{home.icon}</span>
            <b>{home.label}</b>
          </Link>
        ) : null}

        {sectionNames.map((section) => {
          const sectionLinks = links.filter((link) => link.section === section);
          if (!sectionLinks.length) return null;

          return (
            <div className="app-sidebar-section" key={section}>
              <small>{section}</small>
              {sectionLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`app-sidebar-link ${isActive(link.href) ? 'active' : ''} ${link.rm ? 'rm' : ''}`}
                >
                  <span className="app-sidebar-icon" aria-hidden="true">{link.icon}</span>
                  <b>{link.label}</b>
                </Link>
              ))}
            </div>
          );
        })}
      </>
    );
  }

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
        {renderSidebarLinks()}
      </nav>

      <div className="app-sidebar-user">
        <div className="app-sidebar-avatar">PE</div>
        <div className="app-sidebar-user-text">
          <b>{email ? email.split('@')[0].replace('.', ' ') : 'Usuario'}</b>
          <span>{displayRoleLabel}</span>
        </div>
      </div>

      <button className="app-sidebar-logout" type="button" onClick={logout}>
        <span>Salir</span>
      </button>
    </aside>
  );
}
