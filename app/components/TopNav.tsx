'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { createSupabaseBrowser } from '@/lib/supabase-browser';
import { APP_MODULES, modulesForRole, normalizeAppRole, type AppModule, type AppRole } from '@/lib/permissions';

type Role = 'client' | 'approver' | 'deployment' | 'rm' | 'super_admin' | 'read_only';

const ROLE_LABEL: Record<Role | AppRole, string> = {
  client: 'Cliente Interno',
  approver: 'Aprobador',
  deployment: 'Deployment',
  rm: 'Release Manager',
  super_admin: 'Super Admin',
  read_only: 'Solo Lectura',
};

const ROLE_VISIBLE_MODULE_KEYS: Record<AppRole, string[]> = {
  client: ['inicio', 'nuevo_rdc', 'mis_cambios'],
  read_only: ['inicio', 'mis_cambios'],
  approver: ['inicio', 'mis_aprobaciones'],
  deployment: ['inicio', 'plan_pap', 'cierre', 'deploy_center'],
  rm: [
    'inicio',
    'nuevo_rdc',
    'mis_cambios',
    'release',
    'control_center',
    'aprobaciones',
    'agenda_cab',
    'ecab',
    'plan_pap',
    'cierre',
    'dashboard_dora',
  ],
  super_admin: [
    'inicio',
    'nuevo_rdc',
    'mis_cambios',
    'release',
    'control_center',
    'mis_aprobaciones',
    'aprobaciones',
    'agenda_cab',
    'ecab',
    'plan_pap',
    'cierre',
    'deploy_center',
    'dashboard_dora',
    'admin_users',
  ],
};

const SECTION_ORDER: AppModule['section'][] = ['OPERACIÓN', 'CONTROL', 'EJECUCIÓN', 'MÉTRICAS', 'ADMINISTRACIÓN'];

const MODULE_ORDER = [
  '/',
  '/rdc',
  '/mis-cambios',
  '/release',
  '/control',
  '/mis-aprobaciones',
  '/approvals',
  '/agenda',
  '/ecab',
  '/pap',
  '/deploy',
  '/cierre',
  '/dashboard',
  '/admin/users',
];

function routeIndex(path?: string | null) {
  const normalized = normalizeRoutePath(path || '/');
  const index = MODULE_ORDER.indexOf(normalized);
  return index >= 0 ? index : 999;
}

function normalizeRoutePath(value?: string | null) {
  const clean = String(value || '/').split('?')[0].split('#')[0];
  if (!clean || clean === '/') return '/';
  return clean.endsWith('/') ? clean.slice(0, -1) : clean;
}

function isRouteActive(currentPath: string, href: string) {
  const current = normalizeRoutePath(currentPath);
  const target = normalizeRoutePath(href);
  if (target === '/') return current === '/';
  return current === target || current.startsWith(`${target}/`);
}

function sortModules(items: AppModule[]) {
  const unique = new Map<string, AppModule>();

  for (const item of items) {
    const key = item.path || item.key;
    if (!unique.has(key)) unique.set(key, item);
  }

  return Array.from(unique.values()).sort((a, b) => {
    const sectionDiff = SECTION_ORDER.indexOf(a.section) - SECTION_ORDER.indexOf(b.section);
    if (sectionDiff !== 0) return sectionDiff;

    const routeDiff = routeIndex(a.path) - routeIndex(b.path);
    if (routeDiff !== 0) return routeDiff;

    return a.sort_order - b.sort_order;
  });
}

function moduleCatalog(items: AppModule[]) {
  const catalog = new Map<string, AppModule>();

  for (const item of [...APP_MODULES, ...items]) {
    if (!catalog.has(item.key)) catalog.set(item.key, item);
  }

  return catalog;
}

function modulesForProcessRole(items: AppModule[], role: Role | AppRole) {
  const normalizedRole = normalizeAppRole(role);
  const allowedKeys = ROLE_VISIBLE_MODULE_KEYS[normalizedRole] || ROLE_VISIBLE_MODULE_KEYS.client;
  const catalog = moduleCatalog(items);

  return sortModules(
    allowedKeys
      .map((key) => catalog.get(key))
      .filter(Boolean) as AppModule[],
  );
}

function fallbackModules(role: Role, email: string) {
  const normalizedRole = normalizeAppRole(role);
  return modulesForProcessRole(modulesForRole(normalizedRole), normalizedRole);
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

        const apiRole = normalizeAppRole(data.role || role);
        const apiModules: AppModule[] = Array.isArray(data.modules) && data.modules.length
          ? data.modules
          : [];

        if (apiModules.length) {
          // La API ya devuelve los módulos filtrados por permisos custom del usuario.
          // Solo necesitamos enriquecerlos con metadata del catálogo y ordenarlos.
          const cat = moduleCatalog(apiModules);
          const resolved = apiModules
            .map((m: AppModule) => cat.get(m.key) || m)
            .filter(Boolean) as AppModule[];
          setModules(sortModules(resolved));
        } else {
          setModules(fallbackModules(role, email));
        }
        setDisplayRole(apiRole);
      } catch {
        if (active) setModules(fallbackModules(role, email));
      }
    }

    loadPermissions();
    return () => { active = false; };
  }, [role, email]);

  const isActive = (href: string) => isRouteActive(pathname, href);

  const sections = useMemo(() => {
    const visibleModules = sortModules(modules);

    return SECTION_ORDER
      .map((section) => ({ section, links: visibleModules.filter((module) => module.section === section && module.path !== '/') }))
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
