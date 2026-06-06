create table if not exists approval_roles (
  id uuid primary key default gen_random_uuid(),
  role_name text not null,
  approver_name text not null,
  approver_email text,
  approver_account_id text,
  active boolean default true,
  created_at timestamptz default now()
);

create index if not exists idx_approval_roles_role_name on approval_roles(role_name);
create index if not exists idx_approval_roles_active on approval_roles(active);

-- Semilla inicial editable
insert into approval_roles (role_name, approver_name, approver_email, active)
select 'QA', 'QA', null, true
where not exists (select 1 from approval_roles where role_name = 'QA');

insert into approval_roles (role_name, approver_name, approver_email, active)
select 'DBA', 'DBA', null, true
where not exists (select 1 from approval_roles where role_name = 'DBA');

insert into approval_roles (role_name, approver_name, approver_email, active)
select 'Deployment', 'Deployment', null, true
where not exists (select 1 from approval_roles where role_name = 'Deployment');

insert into approval_roles (role_name, approver_name, approver_email, active)
select 'Release Management', 'Release Management', null, true
where not exists (select 1 from approval_roles where role_name = 'Release Management');

insert into approval_roles (role_name, approver_name, approver_email, active)
select 'Redes', 'Redes', null, true
where not exists (select 1 from approval_roles where role_name = 'Redes');

insert into approval_roles (role_name, approver_name, approver_email, active)
select 'Seguridad', 'Seguridad', null, true
where not exists (select 1 from approval_roles where role_name = 'Seguridad');

insert into approval_roles (role_name, approver_name, approver_email, active)
select 'Infraestructura', 'Infraestructura', null, true
where not exists (select 1 from approval_roles where role_name = 'Infraestructura');

insert into approval_roles (role_name, approver_name, approver_email, active)
select 'Arquitectura', 'Arquitectura', null, true
where not exists (select 1 from approval_roles where role_name = 'Arquitectura');
