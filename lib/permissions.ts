export type AppRole = 'client' | 'approver' | 'rm' | 'super_admin' | 'deployment' | 'read_only';

export type AppModule = {
  key: string;
  label: string;
  path: string;
  icon: string;
  section: 'OPERACIÓN' | 'CONTROL' | 'EJECUCIÓN' | 'MÉTRICAS' | 'ADMINISTRACIÓN';
  sort_order: number;
};

export type AppAction = {
  key: string;
  label: string;
  description: string;
  section: string;
};

export const APP_MODULES: AppModule[] = [
  { key: 'inicio', label: 'Inicio', path: '/', icon: '⌂', section: 'OPERACIÓN', sort_order: 10 },
  { key: 'nuevo_rdc', label: 'Nuevo RDC', path: '/rdc', icon: '＋', section: 'OPERACIÓN', sort_order: 20 },
  { key: 'mis_cambios', label: 'Mis Cambios', path: '/mis-cambios', icon: '◇', section: 'OPERACIÓN', sort_order: 30 },
  { key: 'release', label: 'Release', path: '/release', icon: '○', section: 'OPERACIÓN', sort_order: 40 },
  { key: 'mis_aprobaciones', label: 'Mis Aprobaciones', path: '/mis-aprobaciones', icon: '✓', section: 'CONTROL', sort_order: 50 },
  { key: 'aprobaciones', label: 'Aprobaciones', path: '/approvals', icon: '✓', section: 'CONTROL', sort_order: 60 },
  { key: 'agenda_cab', label: 'Agenda CAB', path: '/cab', icon: '▣', section: 'CONTROL', sort_order: 70 },
  { key: 'ecab', label: 'eCAB', path: '/ecab', icon: '⚡', section: 'CONTROL', sort_order: 75 },
  { key: 'plan_pap', label: 'Plan PAP', path: '/pap', icon: '□', section: 'EJECUCIÓN', sort_order: 80 },
  { key: 'deploy_center', label: 'Deploy Center', path: '/deploy', icon: '↗', section: 'EJECUCIÓN', sort_order: 90 },
  { key: 'cierre', label: 'Cierre', path: '/cierre', icon: '⚑', section: 'EJECUCIÓN', sort_order: 100 },
  { key: 'dashboard_dora', label: 'Dashboard DORA', path: '/dashboard', icon: '⌁', section: 'MÉTRICAS', sort_order: 110 },
  { key: 'admin_users', label: 'Usuarios y permisos', path: '/admin/users', icon: '⚙', section: 'ADMINISTRACIÓN', sort_order: 120 },
];

export const APP_ACTIONS: AppAction[] = [
  { key: 'create_rdc', label: 'Crear RDC', description: 'Puede registrar nuevos cambios.', section: 'RDC' },
  { key: 'edit_rdc', label: 'Editar RDC', description: 'Puede modificar la ficha del cambio.', section: 'RDC' },
  { key: 'send_approval', label: 'Enviar a aprobación', description: 'Puede activar el flujo CAB digital.', section: 'Aprobaciones' },
  { key: 'create_ecab', label: 'Crear eCAB', description: 'Puede registrar solicitudes eCAB digitales.', section: 'eCAB' },
  { key: 'review_ecab', label: 'Revisar eCAB', description: 'Puede revisar, observar o rechazar eCAB como Release Manager.', section: 'eCAB' },
  { key: 'authorize_ecab', label: 'Autorizar eCAB', description: 'Puede autorizar eCAB digitalmente según regla gerencial.', section: 'eCAB' },
  { key: 'approve_change', label: 'Aprobar / observar / rechazar', description: 'Puede registrar decisión como aprobador.', section: 'Aprobaciones' },
  { key: 'view_pap', label: 'Ver PAP', description: 'Puede consultar pasos a producción.', section: 'PAP' },
  { key: 'edit_pap', label: 'Editar PAP', description: 'Puede modificar actividades del plan a producción.', section: 'PAP' },
  { key: 'execute_jenkins', label: 'Ejecutar Jenkins', description: 'Puede disparar pipeline Jenkins.', section: 'Deploy' },
  { key: 'update_jenkins_status', label: 'Consultar estado Jenkins', description: 'Puede consultar/actualizar resultado de ejecución.', section: 'Deploy' },
  { key: 'close_change', label: 'Cerrar cambio', description: 'Puede registrar cierre y evidencias finales.', section: 'Cierre' },
  { key: 'view_metrics', label: 'Ver métricas', description: 'Puede consultar Dashboard DORA.', section: 'Métricas' },
  { key: 'manage_users', label: 'Administrar usuarios', description: 'Puede asignar roles, módulos y permisos.', section: 'Administración' },
];

export const ROLE_DEFAULT_MODULES: Record<AppRole, string[]> = {
  client: ['inicio', 'nuevo_rdc', 'mis_cambios'],
  approver: ['inicio', 'mis_aprobaciones', 'ecab'],
  deployment: ['inicio', 'mis_aprobaciones', 'ecab', 'plan_pap', 'deploy_center', 'cierre'],
  rm: ['inicio', 'nuevo_rdc', 'mis_cambios', 'release', 'aprobaciones', 'agenda_cab', 'ecab', 'plan_pap', 'deploy_center', 'cierre', 'dashboard_dora'],
  super_admin: APP_MODULES.map((module) => module.key),
  read_only: ['inicio', 'mis_cambios', 'ecab', 'dashboard_dora'],
};

export const ROLE_DEFAULT_ACTIONS: Record<AppRole, string[]> = {
  client: ['create_rdc', 'create_ecab'],
  approver: ['approve_change'],
  deployment: ['approve_change', 'view_pap', 'execute_jenkins', 'update_jenkins_status', 'close_change'],
  rm: ['create_rdc', 'edit_rdc', 'send_approval', 'create_ecab', 'review_ecab', 'approve_change', 'view_pap', 'edit_pap', 'execute_jenkins', 'update_jenkins_status', 'close_change', 'view_metrics'],
  super_admin: APP_ACTIONS.map((action) => action.key),
  read_only: ['view_pap', 'view_metrics'],
};

export function normalizeAppRole(value?: string | null): AppRole {
  const raw = String(value || '').trim().toLowerCase();
  if (raw === 'super_admin' || raw === 'super-admin' || raw === 'superadmin' || raw === 'admin') return 'super_admin';
  if (raw === 'rm' || raw === 'release_manager' || raw === 'release-manager') return 'rm';
  if (raw === 'deployment' || raw === 'deploy' || raw === 'implementador') return 'deployment';
  if (raw === 'approver' || raw === 'aprobador') return 'approver';
  if (raw === 'read_only' || raw === 'readonly' || raw === 'solo_lectura') return 'read_only';
  return 'client';
}

export function modulesForRole(role: AppRole) {
  const allowed = new Set(ROLE_DEFAULT_MODULES[role] || ROLE_DEFAULT_MODULES.client);
  return APP_MODULES.filter((module) => allowed.has(module.key)).sort((a, b) => a.sort_order - b.sort_order);
}

export function actionsForRole(role: AppRole) {
  const allowed = new Set(ROLE_DEFAULT_ACTIONS[role] || []);
  return APP_ACTIONS.filter((action) => allowed.has(action.key));
}
