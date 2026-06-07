-- SPRINT_ADMIN_PERMISSIONS_1_0.sql
-- Modelo de Super Admin, módulos y permisos por usuario.

create extension if not exists pgcrypto;

create table if not exists public.app_users (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid null,
  email text not null unique,
  full_name text null,
  role text not null default 'client',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.app_modules (
  key text primary key,
  label text not null,
  path text not null,
  icon text null,
  section text not null,
  sort_order int not null default 100,
  is_active boolean not null default true
);

create table if not exists public.app_permissions (
  key text primary key,
  label text not null,
  description text null,
  section text not null,
  is_active boolean not null default true
);

create table if not exists public.user_module_permissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.app_users(id) on delete cascade,
  module_key text not null references public.app_modules(key) on delete cascade,
  can_view boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, module_key)
);

create table if not exists public.user_action_permissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.app_users(id) on delete cascade,
  permission_key text not null references public.app_permissions(key) on delete cascade,
  allowed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, permission_key)
);

create table if not exists public.permission_audit_log (
  id uuid primary key default gen_random_uuid(),
  target_user_id uuid null references public.app_users(id) on delete set null,
  changed_by_email text null,
  action text not null,
  payload jsonb null,
  created_at timestamptz not null default now()
);

insert into public.app_modules(key, label, path, icon, section, sort_order, is_active) values
('inicio', 'Inicio', '/', '⌂', 'OPERACIÓN', 10, true),
('nuevo_rdc', 'Nuevo RDC', '/rdc', '＋', 'OPERACIÓN', 20, true),
('mis_cambios', 'Mis Cambios', '/mis-cambios', '◇', 'OPERACIÓN', 30, true),
('release', 'Release', '/release', '○', 'OPERACIÓN', 40, true),
('mis_aprobaciones', 'Mis Aprobaciones', '/mis-aprobaciones', '✓', 'CONTROL', 50, true),
('aprobaciones', 'Aprobaciones', '/approvals', '✓', 'CONTROL', 60, true),
('agenda_cab', 'Agenda CAB', '/cab', '▣', 'CONTROL', 70, true),
('plan_pap', 'Plan PAP', '/pap', '□', 'EJECUCIÓN', 80, true),
('deploy_center', 'Deploy Center', '/deploy', '↗', 'EJECUCIÓN', 90, true),
('cierre', 'Cierre', '/cierre', '⚑', 'EJECUCIÓN', 100, true),
('dashboard_dora', 'Dashboard DORA', '/dashboard', '⌁', 'MÉTRICAS', 110, true),
('admin_users', 'Usuarios y permisos', '/admin/users', '⚙', 'ADMINISTRACIÓN', 120, true)
on conflict (key) do update set
  label = excluded.label,
  path = excluded.path,
  icon = excluded.icon,
  section = excluded.section,
  sort_order = excluded.sort_order,
  is_active = excluded.is_active;

insert into public.app_permissions(key, label, description, section, is_active) values
('create_rdc', 'Crear RDC', 'Puede registrar nuevos cambios.', 'RDC', true),
('edit_rdc', 'Editar RDC', 'Puede modificar la ficha del cambio.', 'RDC', true),
('send_approval', 'Enviar a aprobación', 'Puede activar el flujo CAB digital.', 'Aprobaciones', true),
('approve_change', 'Aprobar / observar / rechazar', 'Puede registrar decisión como aprobador.', 'Aprobaciones', true),
('view_pap', 'Ver PAP', 'Puede consultar pasos a producción.', 'PAP', true),
('edit_pap', 'Editar PAP', 'Puede modificar actividades del plan a producción.', 'PAP', true),
('execute_jenkins', 'Ejecutar Jenkins', 'Puede disparar pipeline Jenkins.', 'Deploy', true),
('update_jenkins_status', 'Consultar estado Jenkins', 'Puede consultar/actualizar resultado de ejecución.', 'Deploy', true),
('close_change', 'Cerrar cambio', 'Puede registrar cierre y evidencias finales.', 'Cierre', true),
('view_metrics', 'Ver métricas', 'Puede consultar Dashboard DORA.', 'Métricas', true),
('manage_users', 'Administrar usuarios', 'Puede asignar roles, módulos y permisos.', 'Administración', true)
on conflict (key) do update set
  label = excluded.label,
  description = excluded.description,
  section = excluded.section,
  is_active = excluded.is_active;

-- Usuario inicial Super Admin. Ajusta el correo si corresponde.
insert into public.app_users(email, full_name, role, is_active)
values ('pablo.encina@klap.cl', 'Pablo Encina', 'super_admin', true)
on conflict (email) do update set role = 'super_admin', is_active = true, updated_at = now();
