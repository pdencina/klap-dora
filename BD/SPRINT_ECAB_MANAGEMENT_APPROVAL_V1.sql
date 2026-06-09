-- SPRINT_ECAB_MANAGEMENT_APPROVAL_V1.sql
-- Autorización gerencial digital para eCAB.
-- Corrige Cristian Krauss y asegura autorizadores gerenciales.

create table if not exists public.ecab_management_authorizers (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  area text not null default 'Gerencia',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

update public.ecab_management_authorizers
set name = 'Cristian Krauss'
where name = 'Cristian Kraus';

insert into public.ecab_management_authorizers(name, area, is_active) values
('Rafael Osorio', 'Gerencia', true),
('Julio Quiroz', 'Gerencia', true),
('Cristian Krauss', 'Gerencia', true)
on conflict (name) do update set
  area = excluded.area,
  is_active = excluded.is_active;

-- Índice útil para calcular avance de aprobación gerencial.
create index if not exists idx_ecab_decisions_ecab_stage_actor
on public.ecab_decisions(ecab_id, stage, actor_name, created_at desc);

comment on table public.ecab_management_authorizers is
'Autorizadores gerenciales para flujo eCAB digital.';
