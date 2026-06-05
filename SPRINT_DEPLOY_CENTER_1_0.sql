-- Sprint Deploy Center 1.0
-- Módulo separado para ejecutar/monitorear pipelines Jenkins asociados a RDC/PAP.

create table if not exists public.deployment_runs (
  id uuid primary key default gen_random_uuid(),
  rdc_id uuid not null references public.rdc(id) on delete cascade,
  pap_step_id uuid null references public.pap_steps(id) on delete set null,
  provider text not null default 'jenkins',
  job_name text not null,
  build_number text,
  build_url text,
  queue_url text,
  environment text default 'Producción',
  version text,
  branch_or_tag text,
  status text not null default 'QUEUED',
  result text,
  triggered_by text,
  triggered_at timestamptz not null default now(),
  finished_at timestamptz,
  duration_ms bigint,
  parameters jsonb default '{}'::jsonb,
  raw_response jsonb default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_deployment_runs_rdc_id
on public.deployment_runs (rdc_id);

create index if not exists idx_deployment_runs_status
on public.deployment_runs (status);

create index if not exists idx_deployment_runs_triggered_at
on public.deployment_runs (triggered_at desc);

notify pgrst, 'reload schema';
