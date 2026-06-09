'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { createSupabaseBrowser } from '../../lib/supabase-browser';
import { APP_MODULES, modulesForRole, normalizeAppRole, type AppModule, type AppRole } from '../../lib/permissions';

type Role = 'client' | 'approver' | 'deployment' | 'rm' | 'super_admin' | 'read_only';

const ROLE_LABEL: Record<Role | AppRole, string> = {
  client: 'Cliente Interno',
  approver: 'Aprobador',
  deployment: 'Deployment',
  rm: 'Release Manager',
  super_admin: 'Super Admin',
  read_only: 'Solo Lectura',
};

const ECAB_MODULE: AppModule = {
  key: 'ecab',
  label: 'eCAB',
  path: '/ecab',
  icon: '⚡',
  section: 'CONTROL',
  sort_order: 75,
};

const MODULE_ORDER = [
  'inicio',
  'nuevo_rdc',
  'mis_cambios',
  'release',
  'mis_aprobaciones',
  'aprobaciones',
  'agenda_cab',
  'ecab',
  'plan_pap',
  'deploy_center',
  'cierre',
  'dashboard_dora',
  'admin_users',
];

const SECTION_ORDER: AppModule['section'][] = ['OPERACIÓN', 'CONTROL', 'EJECUCIÓN', 'MÉTRICAS', 'ADMINISTRACIÓN'];

function stableModuleOrder(module: AppModule) {
  const index = MODULE_ORDER.indexOf(module.key);
  return index >= 0 ? index : 999 + module.sort_order;
}

function sortModules(items: AppModule[]) {
  const unique = new Map<string, AppModule>();

  for (const item of items) {
    const key = item.key || item.path;
    if (!unique.has(key)) unique.set(key, item);
  }

  return Array.from(unique.values()).sort((a, b) => {
    const sectionDiff = SECTION_ORDER.indexOf(a.section) - SECTION_ORDER.indexOf(b.section);
    if (sectionDiff !== 0) return sectionDiff;
    return stableModuleOrder(a) - stableModuleOrder(b);
  });
}

function ensureEcabModule(items: AppModule[], shouldShow: boolean) {
  const exists = items.some((item) => item.key === 'ecab' || item.path === '/ecab');
  if (!shouldShow || exists) return sortModules(items);
  return sortModules([...items, ECAB_MODULE]);
}

function normalizeRoutePath(value?: string | null) {
  const path = String(value || '/').split('?')[0].split('#')[0];
  if (!path || path === '/') return '/';
  return path.endsWith('/') ? path.slice(0, -1) : path;
}

function isRouteActive(currentPath: string, href: string) {
  const current = normalizeRoutePath(currentPath);
  const target = normalizeRoutePath(href);

  if (target === '/') return current === '/';

  // Match exact route or nested route only.
  // Prevents /cab from activating on unrelated paths and handles query params safely.
  return current === target || current.startsWith(`${target}/`);
}

function hasEcabSignal(data: any, role: Role | AppRole) {
  if (role === 'super_admin' || role === 'rm') return true;

  const modules = Array.isArray(data?.modules) ? data.modules : [];
  const actions = Array.isArray(data?.actions) ? data.actions : [];
  const allowedModules = Array.isArray(data?.debug?.allowedModules) ? data.debug.allowedModules : [];
  const catalogKeys = Array.isArray(data?.debug?.catalogKeys) ? data.debug.catalogKeys : [];

  return (
    modules.some((module: any) => module?.key === 'ecab' || module?.path === '/ecab') ||
    allowedModules.includes('ecab') ||
    catalogKeys.includes('ecab') ||
    actions.some((action: any) => String(action?.key || '').includes('ecab'))
  );
}


function fallbackModules(role: Role, email: string) {
  const normalized = email.trim().toLowerCase();
  const normalizedRole = normalizeAppRole(role);

  if (role === 'approver' && (normalized === 'ximena.cruz@klap.cl' || normalized.includes('ximena.cruz'))) {
    return ensureEcabModule(modulesForRole('deployment'), true);
  }

  return ensureEcabModule(
    modulesForRole(normalizedRole),
    normalizedRole === 'super_admin' || normalizedRole === 'rm' || normalizedRole === 'deployment' || normalizedRole === 'approver',
  );
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
        const nextModules = Array.isArray(data.modules) && data.modules.length
          ? data.modules
          : fallbackModules(role, email);

        setModules(ensureEcabModule(nextModules, hasEcabSignal(data, apiRole)));
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
