'use client';

import { useMemo, useState } from 'react';
import { APP_ACTIONS, APP_MODULES, ROLE_DEFAULT_ACTIONS, ROLE_DEFAULT_MODULES, normalizeAppRole, type AppRole } from '../../../lib/permissions';

type UserRow = {
  id?: string | null;
  email: string;
  full_name?: string | null;
  role?: string | null;
  is_active?: boolean;
  source?: string;
  modulePermissions?: { module_key: string; can_view: boolean }[];
  actionPermissions?: { permission_key: string; allowed: boolean }[];
};

const ROLE_OPTIONS: { value: AppRole; label: string; description: string }[] = [
  { value: 'client', label: 'Cliente Interno', description: 'Crea RDC y consulta sus cambios.' },
  { value: 'approver', label: 'Aprobador', description: 'Aprueba, observa o rechaza cambios asignados.' },
  { value: 'deployment', label: 'Deployment', description: 'Aprueba desde Deployment y ejecuta PAP/Jenkins.' },
  { value: 'rm', label: 'Release Manager', description: 'Gobierna el flujo completo de cambios.' },
  { value: 'super_admin', label: 'Super Admin', description: 'Administra usuarios, módulos y permisos.' },
  { value: 'read_only', label: 'Solo Lectura', description: 'Consulta información sin ejecutar acciones.' },
];

export default function AdminUsersPage() {
  const [query, setQuery] = useState('');
  const [users, setUsers] = useState<UserRow[]>([]);
  const [selected, setSelected] = useState<UserRow | null>(null);
  const [role, setRole] = useState<AppRole>('client');
  const [fullName, setFullName] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [moduleKeys, setModuleKeys] = useState<Set<string>>(new Set(ROLE_DEFAULT_MODULES.client));
  const [actionKeys, setActionKeys] = useState<Set<string>>(new Set(ROLE_DEFAULT_ACTIONS.client));
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);

  const modulesBySection = useMemo(() => {
    const sections = ['OPERACIÓN', 'CONTROL', 'EJECUCIÓN', 'MÉTRICAS', 'ADMINISTRACIÓN'];
    return sections.map((section) => ({ section, modules: APP_MODULES.filter((module) => module.section === section) })).filter((item) => item.modules.length);
  }, []);

  const actionsBySection = useMemo(() => {
    const sections = Array.from(new Set(APP_ACTIONS.map((action) => action.section)));
    return sections.map((section) => ({ section, actions: APP_ACTIONS.filter((action) => action.section === section) }));
  }, []);

  async function searchUsers() {
    try {
      setLoading(true);
      setStatus('');
      const response = await fetch(`/api/admin/users?q=${encodeURIComponent(query)}`);
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.ok) throw new Error(data?.error || 'No fue posible buscar usuarios');

      const resultUsers: UserRow[] = data.users || [];
      setUsers(resultUsers);

      if (resultUsers.length === 1) {
        selectUser(resultUsers[0]);
        return;
      }

      if (!resultUsers.length) {
        setSelected(null);
        setFullName('');
        setRole('client');
        setIsActive(true);
        setModuleKeys(new Set(ROLE_DEFAULT_MODULES.client));
        setActionKeys(new Set(ROLE_DEFAULT_ACTIONS.client));
        setStatus('No se encontró en la base. Puedes completar el nombre, rol y guardar para crearlo.');
      }
    } catch (error: any) {
      setStatus(error?.message || 'Error buscando usuarios');
    } finally {
      setLoading(false);
    }
  }

  function selectUser(user: UserRow) {
    const nextRole = normalizeAppRole(user.role);

    const savedModules = Array.isArray(user.modulePermissions)
      ? user.modulePermissions.filter((item) => item.can_view).map((item) => item.module_key)
      : [];

    const savedActions = Array.isArray(user.actionPermissions)
      ? user.actionPermissions.filter((item) => item.allowed).map((item) => item.permission_key)
      : [];

    setSelected(user);
    setQuery(user.email);
    setRole(nextRole);
    setFullName(user.full_name || '');
    setIsActive(user.is_active !== false);
    setModuleKeys(new Set(savedModules.length ? savedModules : ROLE_DEFAULT_MODULES[nextRole] || []));
    setActionKeys(new Set(savedActions.length ? savedActions : ROLE_DEFAULT_ACTIONS[nextRole] || []));
    setStatus('');
  }

  function applyRoleDefaults(nextRole: AppRole) {
    setRole(nextRole);
    setModuleKeys(new Set(ROLE_DEFAULT_MODULES[nextRole] || []));
    setActionKeys(new Set(ROLE_DEFAULT_ACTIONS[nextRole] || []));
  }

  function toggleModule(key: string) {
    setModuleKeys((current) => {
      const next = new Set(current);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  function toggleAction(key: string) {
    setActionKeys((current) => {
      const next = new Set(current);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  async function savePermissions() {
    try {
      setLoading(true);
      setStatus('');
      const email = String(selected?.email || query || '').trim().toLowerCase();
      if (!email) throw new Error('Selecciona o escribe un correo para guardar permisos.');
      if (!email.includes('@')) throw new Error('Ingresa un correo válido.');

      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          full_name: fullName,
          role,
          is_active: isActive,
          modulePermissions: APP_MODULES.map((module) => ({ module_key: module.key, can_view: moduleKeys.has(module.key) })),
          actionPermissions: APP_ACTIONS.map((action) => ({ permission_key: action.key, allowed: actionKeys.has(action.key) })),
        }),
      });

      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.ok) throw new Error(data?.error || 'No fue posible guardar permisos');

      const updatedUser: UserRow = {
        ...data.user,
        modulePermissions: data.modulePermissions || [],
        actionPermissions: data.actionPermissions || [],
      };

      setSelected(updatedUser);
      setQuery(updatedUser.email);
      setFullName(updatedUser.full_name || '');
      setUsers((current) => {
        const without = current.filter((item) => item.email !== updatedUser.email);
        return [updatedUser, ...without];
      });

      setStatus('Permisos guardados correctamente. El usuario verá el menú actualizado al refrescar o cambiar de página.');
    } catch (error: any) {
      setStatus(error?.message || 'Error guardando permisos');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="adminPage">
      <section className="adminHero">
        <small>ADMINISTRACIÓN</small>
        <h1>Usuarios y permisos</h1>
        <p>Busca usuarios, asigna un rol base y define qué módulos o acciones puede usar cada persona.</p>
      </section>

      <section className="adminGrid">
        <aside className="adminPanel searchPanel">
          <h2>Buscar usuario</h2>
          <div className="searchBox">
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="correo@klap.cl" />
            <button type="button" onClick={searchUsers} disabled={loading}>{loading ? 'Buscando…' : 'Buscar'}</button>
          </div>

          <div className="userList">
            {users.map((user) => (
              <button key={user.email} type="button" onClick={() => selectUser(user)} className={selected?.email === user.email ? 'userRow active' : 'userRow'}>
                <b>{user.full_name || user.email}</b>
                <span>{user.email}</span>
                <small>{user.role || 'client'} · {user.source || 'app'}</small>
              </button>
            ))}
          </div>
        </aside>

        <section className="adminPanel editorPanel">
          <div className="editorHead">
            <div>
              <small>Usuario seleccionado</small>
              <h2>{selected?.email || query || 'Selecciona un usuario'}</h2>
            </div>
            <label className="activeSwitch">
              <input type="checkbox" checked={isActive} onChange={(event) => setIsActive(event.target.checked)} />
              Activo
            </label>
          </div>

          <div className="formGrid">
            <label>
              Nombre visible
              <input
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                placeholder="Nombre Apellido"
                autoComplete="name"
              />
            </label>
            <label>
              Rol base
              <select value={role} onChange={(event) => applyRoleDefaults(event.target.value as AppRole)}>
                {ROLE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>
          </div>

          <div className="roleHelp">
            <b>{ROLE_OPTIONS.find((item) => item.value === role)?.label}</b>
            <span>{ROLE_OPTIONS.find((item) => item.value === role)?.description}</span>
          </div>

          <h3>Módulos visibles</h3>
          <div className="permissionSections">
            {modulesBySection.map((group) => (
              <div className="permissionBlock" key={group.section}>
                <small>{group.section}</small>
                <div className="permissionGrid">
                  {group.modules.map((module) => (
                    <label key={module.key} className="checkCard">
                      <input type="checkbox" checked={moduleKeys.has(module.key)} onChange={() => toggleModule(module.key)} />
                      <span>{module.icon}</span>
                      <b>{module.label}</b>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <h3>Permisos de acción</h3>
          <div className="permissionSections">
            {actionsBySection.map((group) => (
              <div className="permissionBlock" key={group.section}>
                <small>{group.section}</small>
                <div className="actionGrid">
                  {group.actions.map((action) => (
                    <label key={action.key} className="actionCard">
                      <input type="checkbox" checked={actionKeys.has(action.key)} onChange={() => toggleAction(action.key)} />
                      <div>
                        <b>{action.label}</b>
                        <span>{action.description}</span>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {status ? <div className={status.includes('correctamente') ? 'status ok' : 'status'}>{status}</div> : null}

          <div className="saveBar">
            <button type="button" onClick={savePermissions} disabled={loading || (!selected?.email && !query)}>{loading ? 'Guardando…' : 'Guardar permisos'}</button>
          </div>
        </section>
      </section>

      <style jsx>{`
        .adminPage { padding: 44px 6vw 80px; }
        .adminHero { max-width: 980px; margin: 0 auto 22px; }
        .adminHero small, .editorHead small, .permissionBlock small { color: var(--green-d); text-transform: uppercase; letter-spacing: .22em; font-weight: 900; font-size: 12px; }
        .adminHero h1 { margin: 8px 0 10px; font-size: clamp(38px, 5vw, 64px); line-height: .95; color: var(--navy-d); letter-spacing: -.06em; }
        .adminHero p { margin: 0; color: var(--ink-soft); font-size: 17px; max-width: 720px; line-height: 1.5; }
        .adminGrid { max-width: 1180px; margin: 0 auto; display: grid; grid-template-columns: 340px 1fr; gap: 18px; align-items: start; }
        .adminPanel { background: #fff; border: 1px solid var(--line); border-radius: 22px; padding: 20px; box-shadow: 0 18px 45px rgba(7,59,93,.05); }
        .adminPanel h2, .adminPanel h3 { color: var(--navy-d); margin: 0 0 14px; }
        .searchBox { display: grid; grid-template-columns: 1fr auto; gap: 8px; }
        input, select { width: 100%; border: 1px solid var(--line); border-radius: 14px; padding: 12px 14px; font: inherit; color: var(--ink); background: #fff; }
        button { font: inherit; font-weight: 900; border: 1px solid var(--line); background: #fff; color: var(--navy); border-radius: 999px; padding: 11px 16px; cursor: pointer; }
        button:disabled { opacity: .65; cursor: not-allowed; }
        .userList { display: flex; flex-direction: column; gap: 8px; margin-top: 16px; }
        .userRow { text-align: left; border-radius: 16px; padding: 14px; display: flex; flex-direction: column; gap: 4px; }
        .userRow.active { background: var(--green-soft); border-color: #bbf7d0; color: var(--green-d); }
        .userRow span, .userRow small { color: var(--ink-soft); font-weight: 700; }
        .editorHead { display: flex; justify-content: space-between; gap: 16px; align-items: start; margin-bottom: 16px; }
        .editorHead h2 { margin-top: 4px; }
        .activeSwitch { display: inline-flex; align-items: center; gap: 8px; font-weight: 900; color: var(--navy); }
        .activeSwitch input { width: auto; }
        .formGrid { display: grid; grid-template-columns: 1fr 240px; gap: 12px; margin-bottom: 14px; }
        .formGrid label { color: var(--navy); font-weight: 900; display: flex; flex-direction: column; gap: 6px; }
        .roleHelp { background: #f4f8fb; border: 1px solid var(--line); border-radius: 16px; padding: 14px 16px; margin-bottom: 20px; }
        .roleHelp b { display: block; color: var(--navy-d); }
        .roleHelp span { display: block; color: var(--ink-soft); margin-top: 4px; }
        .permissionSections { display: flex; flex-direction: column; gap: 14px; margin-bottom: 22px; }
        .permissionBlock { border: 1px solid #edf3f7; border-radius: 18px; padding: 14px; background: #fbfdff; }
        .permissionGrid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; margin-top: 10px; }
        .checkCard, .actionCard { background: #fff; border: 1px solid var(--line); border-radius: 14px; padding: 12px; display: flex; align-items: center; gap: 10px; font-weight: 900; color: var(--navy); }
        .checkCard input, .actionCard input { width: auto; }
        .checkCard span { width: 26px; height: 26px; border-radius: 999px; background: var(--green-soft); color: var(--green-d); display: inline-flex; align-items: center; justify-content: center; }
        .actionGrid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; margin-top: 10px; }
        .actionCard { align-items: flex-start; }
        .actionCard b { display: block; color: var(--navy-d); }
        .actionCard span { display: block; color: var(--ink-soft); font-weight: 700; font-size: 12px; margin-top: 3px; line-height: 1.35; }
        .status { border: 1px solid #fecaca; background: #fff1f2; color: #9f1239; border-radius: 16px; padding: 14px 16px; font-weight: 800; margin-bottom: 14px; }
        .status.ok { border-color: #bbf7d0; background: var(--green-soft); color: var(--green-d); }
        .saveBar { display: flex; justify-content: flex-end; }
        .saveBar button { min-width: 220px; background: var(--green); border-color: var(--green); color: #fff; }
        @media(max-width: 980px) { .adminGrid { grid-template-columns: 1fr; } .formGrid, .permissionGrid, .actionGrid { grid-template-columns: 1fr; } }
      `}</style>
    </main>
  );
}
