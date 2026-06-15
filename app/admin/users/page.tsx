'use client';

import { useEffect, useMemo, useState } from 'react';
import { APP_ACTIONS, APP_MODULES, ROLE_DEFAULT_ACTIONS, ROLE_DEFAULT_MODULES, normalizeAppRole, type AppRole } from '@/lib/permissions';

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

function roleLabel(role: string) {
  return ROLE_OPTIONS.find((r) => r.value === role)?.label || role;
}

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
  const [saving, setSaving] = useState(false);
  const [isNewUser, setIsNewUser] = useState(false);

  // Carga usuarios al entrar (últimos 25)
  useEffect(() => {
    loadUsers('');
  }, []);

  const modulesBySection = useMemo(() => {
    const sections = ['OPERACIÓN', 'CONTROL', 'EJECUCIÓN', 'MÉTRICAS', 'ADMINISTRACIÓN'] as const;
    return sections
      .map((section) => ({ section, modules: APP_MODULES.filter((m) => m.section === section) }))
      .filter((item) => item.modules.length);
  }, []);

  const actionsBySection = useMemo(() => {
    const sections = Array.from(new Set(APP_ACTIONS.map((a) => a.section)));
    return sections.map((section) => ({ section, actions: APP_ACTIONS.filter((a) => a.section === section) }));
  }, []);

  // Cuenta cuántos módulos/acciones difieren del default del rol
  const modulesDiff = useMemo(() => {
    const defaults = new Set(ROLE_DEFAULT_MODULES[role] || []);
    let added = 0;
    let removed = 0;
    moduleKeys.forEach((k) => { if (!defaults.has(k)) added++; });
    defaults.forEach((k) => { if (!moduleKeys.has(k)) removed++; });
    return { added, removed };
  }, [moduleKeys, role]);

  const actionsDiff = useMemo(() => {
    const defaults = new Set(ROLE_DEFAULT_ACTIONS[role] || []);
    let added = 0;
    let removed = 0;
    actionKeys.forEach((k) => { if (!defaults.has(k)) added++; });
    defaults.forEach((k) => { if (!actionKeys.has(k)) removed++; });
    return { added, removed };
  }, [actionKeys, role]);

  async function loadUsers(q: string) {
    try {
      setLoading(true);
      setStatus('');
      const response = await fetch(`/api/admin/users?q=${encodeURIComponent(q)}`, { cache: 'no-store' });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.ok) throw new Error(data?.error || 'No fue posible cargar usuarios');
      setUsers(data.users || []);
    } catch (error: any) {
      setStatus(error?.message || 'Error cargando usuarios');
    } finally {
      setLoading(false);
    }
  }

  async function searchUsers(e?: React.FormEvent) {
    e?.preventDefault();
    await loadUsers(query);
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
    setIsNewUser(false);
    setQuery(user.email);
    setRole(nextRole);
    setFullName(user.full_name || '');
    setIsActive(user.is_active !== false);
    // Si tiene permisos custom guardados, usar esos. Si no, usar defaults del rol.
    setModuleKeys(new Set(savedModules.length ? savedModules : ROLE_DEFAULT_MODULES[nextRole] || []));
    setActionKeys(new Set(savedActions.length ? savedActions : ROLE_DEFAULT_ACTIONS[nextRole] || []));
    setStatus('');
  }

  function clearSelection() {
    setSelected(null);
    setQuery('');
    setFullName('');
    setRole('client');
    setIsActive(true);
    setModuleKeys(new Set(ROLE_DEFAULT_MODULES.client));
    setActionKeys(new Set(ROLE_DEFAULT_ACTIONS.client));
    setStatus('');
    setIsNewUser(true);
  }

  function cancelEdit() {
    setSelected(null);
    setQuery('');
    setFullName('');
    setRole('client');
    setIsActive(true);
    setModuleKeys(new Set(ROLE_DEFAULT_MODULES.client));
    setActionKeys(new Set(ROLE_DEFAULT_ACTIONS.client));
    setStatus('');
    setIsNewUser(false);
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

  function selectAllModules() {
    setModuleKeys(new Set(APP_MODULES.map((m) => m.key)));
  }

  function selectAllActions() {
    setActionKeys(new Set(APP_ACTIONS.map((a) => a.key)));
  }

  function resetToDefaults() {
    setModuleKeys(new Set(ROLE_DEFAULT_MODULES[role] || []));
    setActionKeys(new Set(ROLE_DEFAULT_ACTIONS[role] || []));
  }

  async function savePermissions() {
    try {
      setSaving(true);
      setStatus('');
      const email = String(selected?.email || query || '').trim().toLowerCase();
      if (!email) throw new Error('Selecciona o escribe un correo para guardar permisos.');
      if (!email.includes('@')) throw new Error('Ingresa un correo válido.');

      // Solo enviar los módulos marcados (can_view: true) y acciones permitidas (allowed: true)
      const modulePermissions = Array.from(moduleKeys).map((key) => ({ module_key: key, can_view: true }));
      const actionPermissions = Array.from(actionKeys).map((key) => ({ permission_key: key, allowed: true }));

      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          full_name: fullName,
          role,
          is_active: isActive,
          modulePermissions,
          actionPermissions,
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
      setUsers((current) => {
        const without = current.filter((item) => item.email !== updatedUser.email);
        return [updatedUser, ...without];
      });

      setStatus('✓ Permisos guardados correctamente. El usuario verá los cambios al refrescar.');
    } catch (error: any) {
      setStatus(error?.message || 'Error guardando permisos');
    } finally {
      setSaving(false);
    }
  }

  function isModuleDefault(key: string) {
    return (ROLE_DEFAULT_MODULES[role] || []).includes(key);
  }

  function isActionDefault(key: string) {
    return (ROLE_DEFAULT_ACTIONS[role] || []).includes(key);
  }

  return (
    <main className="adminPage">
      <section className="adminHero">
        <small>ADMINISTRACIÓN</small>
        <h1>Usuarios y permisos</h1>
        <p>Busca usuarios por correo o nombre, asigna un rol base y personaliza módulos y acciones.</p>
      </section>

      <section className="adminGrid">
        <aside className="adminPanel searchPanel">
          <h2>Usuarios</h2>
          <form className="searchBox" onSubmit={searchUsers}>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="correo@klap.cl"
            />
            <button type="submit" disabled={loading}>
              {loading ? '…' : '🔍'}
            </button>
          </form>

          <div className="userList">
            {users.length === 0 && !loading ? (
              <p className="emptyList">No se encontraron usuarios.</p>
            ) : null}
            {users.map((user) => (
              <button
                key={user.email}
                type="button"
                onClick={() => selectUser(user)}
                className={selected?.email === user.email ? 'userRow active' : 'userRow'}
              >
                <b>{user.full_name || user.email.split('@')[0]}</b>
                <span>{user.email}</span>
                <small className={user.is_active === false ? 'inactive' : ''}>
                  {roleLabel(normalizeAppRole(user.role))}
                  {user.is_active === false ? ' · Inactivo' : ''}
                </small>
              </button>
            ))}
          </div>

          <button type="button" className="newUserBtn" onClick={clearSelection}>
            + Nuevo usuario
          </button>
        </aside>

        <section className="adminPanel editorPanel">
          {!selected && !query && !isNewUser ? (
            <div className="emptyEditor">
              <p>Selecciona un usuario de la lista o busca por correo para editar sus permisos.</p>
            </div>
          ) : (
            <>
              <div className="editorHead">
                <div>
                  <small>{selected ? 'Editando usuario' : 'Nuevo usuario'}</small>
                  <h2>{selected?.email || 'Nuevo usuario'}</h2>
                </div>
                <div className="headActions">
                  <label className="activeSwitch">
                    <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
                    {isActive ? 'Activo' : 'Inactivo'}
                  </label>
                </div>
              </div>

              <div className="formGrid">
                <label>
                  Correo
                  <input
                    value={selected?.email || query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="correo@klap.cl"
                    disabled={Boolean(selected?.id)}
                  />
                </label>
                <label>
                  Nombre visible
                  <input
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Nombre Apellido"
                  />
                </label>
                <label>
                  Rol base
                  <select value={role} onChange={(e) => applyRoleDefaults(e.target.value as AppRole)}>
                    {ROLE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="roleHelp">
                <b>{ROLE_OPTIONS.find((r) => r.value === role)?.label}</b>
                <span>{ROLE_OPTIONS.find((r) => r.value === role)?.description}</span>
              </div>

              {/* Módulos */}
              <div className="sectionHeader">
                <h3>Módulos visibles</h3>
                <div className="quickActions">
                  <button type="button" onClick={resetToDefaults} className="linkBtn">Reset defaults</button>
                  <button type="button" onClick={selectAllModules} className="linkBtn">Todos</button>
                </div>
              </div>
              {(modulesDiff.added > 0 || modulesDiff.removed > 0) ? (
                <p className="diffNote">
                  {modulesDiff.added > 0 ? `+${modulesDiff.added} extra` : ''}
                  {modulesDiff.added > 0 && modulesDiff.removed > 0 ? ' · ' : ''}
                  {modulesDiff.removed > 0 ? `−${modulesDiff.removed} removido${modulesDiff.removed > 1 ? 's' : ''}` : ''}
                  {' '}respecto al default del rol
                </p>
              ) : null}
              <div className="permissionSections">
                {modulesBySection.map((group) => (
                  <div className="permissionBlock" key={group.section}>
                    <small>{group.section}</small>
                    <div className="permissionGrid">
                      {group.modules.map((module) => {
                        const checked = moduleKeys.has(module.key);
                        const isDefault = isModuleDefault(module.key);
                        return (
                          <label key={module.key} className={`checkCard ${checked ? 'checked' : ''} ${!isDefault && checked ? 'custom' : ''}`}>
                            <input type="checkbox" checked={checked} onChange={() => toggleModule(module.key)} />
                            <span className="moduleIcon">{module.icon}</span>
                            <b>{module.label}</b>
                            {!isDefault && checked ? <i className="customBadge">custom</i> : null}
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              {/* Acciones */}
              <div className="sectionHeader">
                <h3>Permisos de acción</h3>
                <div className="quickActions">
                  <button type="button" onClick={resetToDefaults} className="linkBtn">Reset defaults</button>
                  <button type="button" onClick={selectAllActions} className="linkBtn">Todos</button>
                </div>
              </div>
              {(actionsDiff.added > 0 || actionsDiff.removed > 0) ? (
                <p className="diffNote">
                  {actionsDiff.added > 0 ? `+${actionsDiff.added} extra` : ''}
                  {actionsDiff.added > 0 && actionsDiff.removed > 0 ? ' · ' : ''}
                  {actionsDiff.removed > 0 ? `−${actionsDiff.removed} removido${actionsDiff.removed > 1 ? 's' : ''}` : ''}
                  {' '}respecto al default del rol
                </p>
              ) : null}
              <div className="permissionSections">
                {actionsBySection.map((group) => (
                  <div className="permissionBlock" key={group.section}>
                    <small>{group.section}</small>
                    <div className="actionGrid">
                      {group.actions.map((action) => {
                        const checked = actionKeys.has(action.key);
                        const isDefault = isActionDefault(action.key);
                        return (
                          <label key={action.key} className={`actionCard ${checked ? 'checked' : ''} ${!isDefault && checked ? 'custom' : ''}`}>
                            <input type="checkbox" checked={checked} onChange={() => toggleAction(action.key)} />
                            <div>
                              <b>{action.label}</b>
                              <span>{action.description}</span>
                              {!isDefault && checked ? <i className="customBadge">custom</i> : null}
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              {status ? (
                <div className={status.startsWith('✓') ? 'status ok' : 'status err'}>{status}</div>
              ) : null}

              <div className="saveBar">
                <button type="button" className="secondary" onClick={cancelEdit}>Cancelar</button>
                <button type="button" className="primary" onClick={savePermissions} disabled={saving || (!selected?.email && !query)}>
                  {saving ? 'Guardando…' : 'Guardar permisos'}
                </button>
              </div>
            </>
          )}
        </section>
      </section>

      <style jsx>{`
        .adminPage { padding: 36px 6vw 80px; }
        .adminHero { max-width: 1100px; margin: 0 auto 22px; }
        .adminHero small, .editorHead small, .permissionBlock small { color: var(--green-d); text-transform: uppercase; letter-spacing: .18em; font-weight: 900; font-size: 11px; }
        .adminHero h1 { margin: 8px 0 10px; font-size: clamp(34px, 4.5vw, 56px); line-height: .95; color: var(--navy-d); letter-spacing: -.05em; }
        .adminHero p { margin: 0; color: var(--ink-soft); font-size: 16px; max-width: 640px; line-height: 1.5; }

        .adminGrid { max-width: 1200px; margin: 0 auto; display: grid; grid-template-columns: 320px 1fr; gap: 18px; align-items: start; }
        .adminPanel { background: #fff; border: 1px solid var(--line); border-radius: 22px; padding: 20px; box-shadow: 0 18px 45px rgba(7,59,93,.05); }
        .adminPanel h2 { color: var(--navy-d); margin: 0 0 14px; font-size: 20px; }
        .adminPanel h3 { color: var(--navy-d); margin: 0; font-size: 16px; }

        .searchBox { display: grid; grid-template-columns: 1fr 44px; gap: 8px; }
        input, select { width: 100%; border: 1px solid var(--line); border-radius: 12px; padding: 11px 13px; font: inherit; font-size: 14px; color: var(--ink); background: #fff; }
        input:focus, select:focus { border-color: var(--green); outline: none; box-shadow: 0 0 0 3px rgba(0,193,110,.1); }
        input:disabled { background: #f8fbfd; color: var(--ink-soft); }

        button { font: inherit; font-size: 13px; font-weight: 800; border: 1px solid var(--line); background: #fff; color: var(--navy); border-radius: 999px; padding: 10px 14px; cursor: pointer; transition: background .15s; }
        button:hover { background: #f4f8fb; }
        button:disabled { opacity: .55; cursor: not-allowed; }

        .userList { display: flex; flex-direction: column; gap: 6px; margin-top: 14px; max-height: 500px; overflow-y: auto; }
        .emptyList { color: var(--ink-soft); font-size: 13px; text-align: center; padding: 20px 0; margin: 0; }
        .userRow { text-align: left; border-radius: 14px; padding: 12px; display: flex; flex-direction: column; gap: 3px; border: 1px solid transparent; transition: background .15s, border-color .15s; }
        .userRow:hover { background: #f4f8fb; }
        .userRow.active { background: var(--green-soft); border-color: #bbf7d0; }
        .userRow b { font-size: 14px; color: var(--navy-d); }
        .userRow span { color: var(--ink-soft); font-size: 12px; font-weight: 600; }
        .userRow small { color: var(--ink-soft); font-size: 11px; font-weight: 700; }
        .userRow small.inactive { color: #b42318; }

        .newUserBtn { margin-top: 14px; width: 100%; background: var(--bg); border: 1px dashed var(--line); color: var(--green-d); }
        .newUserBtn:hover { background: var(--green-soft); border-color: #bbf7d0; }

        .emptyEditor { padding: 60px 20px; text-align: center; }
        .emptyEditor p { color: var(--ink-soft); font-size: 15px; max-width: 360px; margin: 0 auto; line-height: 1.5; }

        .editorHead { display: flex; justify-content: space-between; gap: 16px; align-items: start; margin-bottom: 18px; padding-bottom: 14px; border-bottom: 1px solid #edf3f7; }
        .editorHead h2 { margin-top: 4px; font-size: 18px; }
        .headActions { display: flex; gap: 10px; align-items: center; }
        .activeSwitch { display: inline-flex; align-items: center; gap: 8px; font-weight: 800; font-size: 13px; color: var(--navy); padding: 8px 14px; border-radius: 999px; border: 1px solid var(--line); background: #fff; cursor: pointer; }
        .activeSwitch input { width: auto; accent-color: var(--green); }

        .formGrid { display: grid; grid-template-columns: 1fr 1fr 200px; gap: 12px; margin-bottom: 14px; }
        .formGrid label { color: var(--navy); font-weight: 800; font-size: 13px; display: flex; flex-direction: column; gap: 6px; }

        .roleHelp { background: #f4f8fb; border: 1px solid var(--line); border-radius: 14px; padding: 12px 16px; margin-bottom: 22px; }
        .roleHelp b { display: block; color: var(--navy-d); font-size: 14px; }
        .roleHelp span { display: block; color: var(--ink-soft); margin-top: 4px; font-size: 13px; }

        .sectionHeader { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
        .quickActions { display: flex; gap: 8px; }
        .linkBtn { border: none; background: none; color: var(--green-d); font-size: 12px; font-weight: 800; padding: 6px 10px; border-radius: 8px; }
        .linkBtn:hover { background: var(--green-soft); }

        .diffNote { margin: 0 0 10px; font-size: 12px; font-weight: 700; color: #b45309; background: #fffbeb; padding: 6px 12px; border-radius: 8px; display: inline-block; }

        .permissionSections { display: flex; flex-direction: column; gap: 12px; margin-bottom: 24px; }
        .permissionBlock { border: 1px solid #edf3f7; border-radius: 16px; padding: 12px; background: #fbfdff; }
        .permissionGrid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; margin-top: 8px; }

        .checkCard, .actionCard { position: relative; background: #fff; border: 1px solid var(--line); border-radius: 12px; padding: 10px 12px; display: flex; align-items: center; gap: 9px; font-weight: 800; color: var(--ink-soft); font-size: 13px; cursor: pointer; transition: border-color .15s, background .15s; }
        .checkCard:hover, .actionCard:hover { border-color: #a7e8c4; }
        .checkCard.checked, .actionCard.checked { border-color: #bbf7d0; background: #f0fff7; color: var(--navy-d); }
        .checkCard.custom, .actionCard.custom { border-color: #fde68a; background: #fffef5; }
        .checkCard input, .actionCard input { width: auto; accent-color: var(--green); flex: none; }
        .moduleIcon { width: 24px; height: 24px; border-radius: 8px; background: var(--bg); display: inline-flex; align-items: center; justify-content: center; font-size: 13px; flex: none; }
        .checkCard.checked .moduleIcon { background: var(--green-soft); color: var(--green-d); }
        .customBadge { position: absolute; top: 6px; right: 8px; font-style: normal; font-size: 9px; font-weight: 900; color: #b45309; background: #fef3c7; padding: 2px 6px; border-radius: 6px; text-transform: uppercase; letter-spacing: .05em; }

        .actionGrid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; margin-top: 8px; }
        .actionCard { align-items: flex-start; }
        .actionCard b { display: block; color: var(--navy-d); font-size: 13px; }
        .actionCard span { display: block; color: var(--ink-soft); font-weight: 600; font-size: 11px; margin-top: 2px; line-height: 1.35; }

        .status { border-radius: 14px; padding: 14px 16px; font-weight: 700; font-size: 14px; margin-bottom: 14px; }
        .status.ok { border: 1px solid #bbf7d0; background: var(--green-soft); color: var(--green-d); }
        .status.err { border: 1px solid #fecaca; background: #fff1f2; color: #9f1239; }

        .saveBar { display: flex; justify-content: flex-end; gap: 10px; padding-top: 14px; border-top: 1px solid #edf3f7; }
        .saveBar .secondary { background: #fff; color: var(--ink-soft); }
        .saveBar .primary { min-width: 180px; background: var(--green); border-color: var(--green); color: #fff; }
        .saveBar .primary:hover { background: var(--green-d); }

        @media(max-width: 1000px) {
          .adminGrid { grid-template-columns: 1fr; }
          .formGrid { grid-template-columns: 1fr; }
          .permissionGrid { grid-template-columns: repeat(2, 1fr); }
          .actionGrid { grid-template-columns: 1fr; }
        }
        @media(max-width: 600px) {
          .permissionGrid { grid-template-columns: 1fr; }
        }
      `}</style>
    </main>
  );
}
