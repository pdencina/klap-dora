-- Sprint Cierre 1.0
-- Registra el resultado real del despliegue, validaciones y evidencias para alimentar DORA.

create table if not exists public.change_closures (
  id uuid primary key default gen_random_uuid(),
  rdc_id uuid not null references public.rdc(id) on delete cascade,
  deployment_run_id uuid null references public.deployment_runs(id) on delete set null,

  result text not null,
  real_start_at timestamptz,
  real_end_at timestamptz,

  had_rollback boolean not null default false,
  had_incident boolean not null default false,
  incident_jira text,

  qa_validation text,
  business_validation text,
  technical_validation text,
  service_impact text,
  observations text,

  closed_by text,
  closed_at timestamptz not null default now(),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_change_closures_rdc_id
on public.change_closures (rdc_id);

create index if not exists idx_change_closures_closed_at
on public.change_closures (closed_at desc);

create index if not exists idx_change_closures_result
on public.change_closures (result);

notify pgrst, 'reload schema';
