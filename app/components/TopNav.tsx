'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { createSupabaseBrowser } from '../../lib/supabase-browser';
import { APP_MODULES, modulesForRole, normalizeAppRole, type AppModule, type AppRole } from '../../lib/permissions';

type Role = 'client' | 'approver' | 'rm' | 'super_admin';

const ROLE_LABEL: Record<Role | AppRole, string> = {
  client: 'Cliente Interno',
  approver: 'Aprobador',
  deployment: 'Deployment',
  rm: 'Release Manager',
  super_admin: 'Super Admin',
  read_only: 'Solo Lectura',
};

function fallbackModules(role: Role, email: string) {
  const normalized = email.trim().toLowerCase();
  if (role === 'approver' && (normalized === 'ximena.cruz@klap.cl' || normalized.includes('ximena.cruz'))) {
    return modulesForRole('deployment');
  }
  return modulesForRole(normalizeAppRole(role));
}

export default function TopNav({ role, email }: { role: Role; email: string }) {
  const pathname = usePathname() || '/';
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [modules, setModules] = useState<AppModule[]>(() => fallbackModules(role, email));
  const [displayRole, setDisplayRole] = useState<AppRole>(() => normalizeAppRole(role));

  useEffect(() => {
    let active = true;

    async function loadPermissions() {
      try {
        const response = await fetch('/api/admin/my-permissions', { cache: 'no-store' });
        const data = await response.json().catch(() => null);
        if (!active || !data?.ok) return;

        const nextModules = Array.isArray(data.modules) && data.modules.length
          ? data.modules
          : fallbackModules(role, email);

        setModules(nextModules);
        setDisplayRole(normalizeAppRole(data.role || role));
      } catch {
        if (active) setModules(fallbackModules(role, email));
      }
    }

    loadPermissions();
    return () => { active = false; };
  }, [role, email]);

  const isActive = (href: string) => (href === '/' ? pathname === '/' : pathname.startsWith(href));

  const sections = useMemo(() => {
    const orderedSections: AppModule['section'][] = ['OPERACIÓN', 'CONTROL', 'EJECUCIÓN', 'MÉTRICAS', 'ADMINISTRACIÓN'];
    return orderedSections
      .map((section) => ({ section, links: modules.filter((module) => module.section === section && module.path !== '/') }))
      .filter((group) => group.links.length);
  }, [modules]);

  const home = modules.find((module) => module.path === '/') || APP_MODULES[0];

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
        <Link
          href={home.path}
          className={`app-sidebar-link ${isActive(home.path) ? 'active' : ''}`}
        >
          <span className="app-sidebar-icon" aria-hidden="true">{home.icon}</span>
          <b>{home.label}</b>
        </Link>

        {sections.map((group) => (
          <div className="app-sidebar-section" key={group.section}>
            <small>{group.section}</small>
            {group.links.map((link) => (
              <Link
                key={link.key}
                href={link.path}
                className={`app-sidebar-link ${isActive(link.path) ? 'active' : ''}`}
              >
                <span className="app-sidebar-icon" aria-hidden="true">{link.icon}</span>
                <b>{link.label}</b>
              </Link>
            ))}
          </div>
        ))}
      </nav>

      <div className="app-sidebar-user">
        <div className="app-sidebar-avatar">PE</div>
        <div className="app-sidebar-user-text">
          <b>{email ? email.split('@')[0].replace('.', ' ') : 'Usuario'}</b>
          <span>{ROLE_LABEL[displayRole] || ROLE_LABEL[role]}</span>
        </div>
      </div>

      <button className="app-sidebar-logout" type="button" onClick={logout}>
        <span>Salir</span>
      </button>
    </aside>
  );
}
