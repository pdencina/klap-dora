-- SPRINT_ECAB_REVIEW_RM_V1.sql
-- Revisión inicial del eCAB por Release Manager y registro de autorizadores gerenciales.
-- No es destructivo. La lógica principal usa ecab_decisions y ecab_audit_log.

create table if not exists public.ecab_management_authorizers (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  area text not null default 'Gerencia',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.ecab_management_authorizers(name, area, is_active) values
('Rafael Osorio', 'Gerencia', true),
('Julio Quiroz', 'Gerencia', true),
('Cristian Kraus', 'Gerencia', true)
on conflict (name) do update set
  area = excluded.area,
  is_active = excluded.is_active;

comment on table public.ecab_management_authorizers is
'Autorizadores gerenciales para flujo eCAB digital. La aprobación efectiva se registra en ecab_decisions.';
