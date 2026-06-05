-- Sprint Roles & Permissions
-- Asignación de roles por usuario en Supabase Auth.
-- No crea usuarios: primero créalos desde Supabase > Authentication > Users.

-- Roles soportados:
-- rm        : Release Manager. Ve y administra todo el flujo.
-- client    : Cliente Interno. Crea RDC y ve sus cambios.
-- approver  : Aprobador. Ve sus aprobaciones asignadas y decide por OTP.

-- === EJEMPLOS ===
-- Cambia los correos antes de ejecutar.

-- Release Manager / Gerencia / Arquitectura con acceso completo
update auth.users
set raw_app_meta_data =
  coalesce(raw_app_meta_data, '{}'::jsonb) ||
  jsonb_build_object('role', 'rm')
where email in (
  'pablo.encina@klap.cl',
  'julio.quiroz@klap.cl'
);

-- Cliente interno / solicitante
update auth.users
set raw_app_meta_data =
  coalesce(raw_app_meta_data, '{}'::jsonb) ||
  jsonb_build_object('role', 'client')
where email in (
  'cliente.interno@klap.cl'
);

-- Aprobadores CAB
update auth.users
set raw_app_meta_data =
  coalesce(raw_app_meta_data, '{}'::jsonb) ||
  jsonb_build_object('role', 'approver')
where email in (
  'erika.fica@klap.cl',
  'andres.avilan@klap.cl',
  'ximena.cruz@klap.cl'
);

-- Validación
select
  email,
  raw_app_meta_data ->> 'role' as role
from auth.users
where email ilike '%@klap.cl'
order by email;

notify pgrst, 'reload schema';
