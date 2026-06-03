-- Sprint 10 - Matriz Corporativa de Aprobaciones
-- Ejecutar solo si faltan columnas.

alter table approval_roles
add column if not exists approver_account_id text;

alter table approval_requests
add column if not exists approver_account_id text;

alter table approval_requests
add column if not exists approval_token text unique default gen_random_uuid()::text;

create index if not exists idx_approval_roles_role_name on approval_roles(role_name);
create index if not exists idx_approval_roles_active on approval_roles(active);
create index if not exists idx_approval_requests_token on approval_requests(approval_token);
create index if not exists idx_approval_requests_account_id on approval_requests(approver_account_id);

-- Matriz actual esperada:
-- role_name                    approver_name
-- Operaciones y Procesos       Alejandro Ojeda
-- Tecnología                   Erika Fica
-- Arquitectura                 Juan Carlos Galaz
-- Riesgos                      Nicolás Oliveros
-- Ciberseguridad               Cristian Krauss
-- Marcas                       Ingrid Núñez
-- Desarrollo de Negocios       Víctor Peña y Lillo
-- Infraestructura              Juan Valle
-- Deployment                   Ximena Cruz
-- DBA                          Andrés Avilán
-- Data Engineering & Analytics Felipe Leibur
