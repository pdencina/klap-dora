-- SPRINT_ECAB_MENU_FIX.sql
-- Hace visible el módulo eCAB en el menú lateral dentro de CONTROL.
-- Ejecutar si el menú se alimenta desde BD o permisos dinámicos.

insert into public.app_modules(key, label, path, icon, section, sort_order, is_active)
values ('ecab', 'eCAB', '/ecab', '⚡', 'CONTROL', 75, true)
on conflict (key) do update set
  label = excluded.label,
  path = excluded.path,
  icon = excluded.icon,
  section = excluded.section,
  sort_order = excluded.sort_order,
  is_active = true;

insert into public.app_permissions(key, label, description, section, is_active) values
('create_ecab', 'Crear eCAB', 'Puede registrar solicitudes eCAB digitales.', 'eCAB', true),
('review_ecab', 'Revisar eCAB', 'Puede revisar, observar o rechazar eCAB como Release Manager.', 'eCAB', true),
('authorize_ecab', 'Autorizar eCAB', 'Puede autorizar eCAB digitalmente según regla gerencial.', 'eCAB', true)
on conflict (key) do update set
  label = excluded.label,
  description = excluded.description,
  section = excluded.section,
  is_active = true;

-- Si tu modelo tiene tabla user_module_permissions, asigna eCAB a Super Admin manualmente
-- desde /admin/users, o ejecuta un insert equivalente según tu esquema actual.
