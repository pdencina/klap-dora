-- SPRINT_ECAB_INTEGRATION_RDC_MENU.sql
-- Integra eCAB al menú/permisos y mantiene eCAB como expediente digital asociado a RDC.

-- 1) Registrar módulo eCAB en catálogo de módulos, si existe.
insert into public.app_modules(key, label, path, icon, section, sort_order, is_active)
values ('ecab', 'eCAB', '/ecab', '⚡', 'CONTROL', 75, true)
on conflict (key) do update set
  label = excluded.label,
  path = excluded.path,
  icon = excluded.icon,
  section = excluded.section,
  sort_order = excluded.sort_order,
  is_active = excluded.is_active;

-- 2) Registrar permisos eCAB en catálogo de acciones, si existe.
insert into public.app_permissions(key, label, description, section, is_active) values
('create_ecab', 'Crear eCAB', 'Puede registrar solicitudes eCAB digitales.', 'eCAB', true),
('review_ecab', 'Revisar eCAB', 'Puede revisar, observar o rechazar eCAB como Release Manager.', 'eCAB', true),
('authorize_ecab', 'Autorizar eCAB', 'Puede autorizar eCAB digitalmente según regla gerencial.', 'eCAB', true)
on conflict (key) do update set
  label = excluded.label,
  description = excluded.description,
  section = excluded.section,
  is_active = excluded.is_active;

-- 3) Asegurar columnas opcionales de eCAB por si ya ejecutaste una versión anterior.
alter table if exists public.ecab_requests
  add column if not exists approval_rule text not null default '2_of_3';

comment on column public.ecab_requests.approval_rule is
'Regla de autorización gerencial para eCAB: 1_of_3, 2_of_3 o 3_of_3.';


-- Diagnóstico:
-- Si /ecab no aparece en menú, revisar que el usuario tenga permiso can_view=true para module_key='ecab'.
-- Para Super Admin, el menú debería tomarlo desde APP_MODULES o desde app_modules.
