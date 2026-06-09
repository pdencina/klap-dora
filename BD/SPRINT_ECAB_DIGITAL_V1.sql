-- SPRINT_ECAB_DIGITAL_V1.sql
-- eCAB 100% digital: sin correos ni Teams como evidencia oficial.

create table if not exists public.ecab_requests (
  id uuid primary key default gen_random_uuid(),
  rdc_id uuid null references public.rdc(id) on delete set null,

  title text not null,
  system text null,
  cell text null,
  technical_lead text null,
  validator text null,

  urgency_reason text not null,
  problem text not null,
  solution text not null,
  risk text not null,
  impact text not null,
  proposed_deploy_at text not null,
  post_validation_at text not null,
  production_validation_plan text not null,
  affected_systems text not null,
  jira_or_erfc_url text not null,

  status text not null default 'rm_review'
    check (status in (
      'draft','rm_review','rm_observed','rm_rejected',
      'pre_review','pre_observed','pre_ok',
      'management_authorization','management_observed','management_rejected',
      'ready_for_pap','pap_created','ready_for_deploy',
      'implementation','post_validation','closed','cancelled'
    )),

  approval_rule text not null default '2_of_3',
  created_by text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ecab_decisions (
  id uuid primary key default gen_random_uuid(),
  ecab_id uuid not null references public.ecab_requests(id) on delete cascade,
  stage text not null check (stage in ('rm','pre_review','management','pap','deploy','close')),
  decision text not null check (decision in ('approve','observe','reject','cancel','close')),
  comment text null,
  actor_email text null,
  actor_name text null,
  created_at timestamptz not null default now()
);

create table if not exists public.ecab_observations (
  id uuid primary key default gen_random_uuid(),
  ecab_id uuid not null references public.ecab_requests(id) on delete cascade,
  area text null,
  observation text not null,
  status text not null default 'open' check (status in ('open','resolved','dismissed')),
  created_by text null,
  resolved_by text null,
  created_at timestamptz not null default now(),
  resolved_at timestamptz null
);

create table if not exists public.ecab_evidences (
  id uuid primary key default gen_random_uuid(),
  ecab_id uuid not null references public.ecab_requests(id) on delete cascade,
  evidence_type text not null default 'digital_record',
  title text not null,
  file_url text null,
  content text null,
  created_by text null,
  created_at timestamptz not null default now()
);

create table if not exists public.ecab_audit_log (
  id uuid primary key default gen_random_uuid(),
  ecab_id uuid not null references public.ecab_requests(id) on delete cascade,
  event_type text not null,
  actor_email text null,
  from_status text null,
  to_status text null,
  detail text null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_ecab_requests_status on public.ecab_requests(status);
create index if not exists idx_ecab_requests_rdc_id on public.ecab_requests(rdc_id);
create index if not exists idx_ecab_decisions_ecab_id on public.ecab_decisions(ecab_id);
create index if not exists idx_ecab_observations_ecab_id on public.ecab_observations(ecab_id);
create index if not exists idx_ecab_evidences_ecab_id on public.ecab_evidences(ecab_id);
create index if not exists idx_ecab_audit_log_ecab_id on public.ecab_audit_log(ecab_id);

comment on table public.ecab_requests is 'Solicitudes eCAB 100% digitales. Reemplaza correo/Teams como evidencia oficial.';
comment on table public.ecab_audit_log is 'Historial auditable de eventos, estados y decisiones del expediente eCAB digital.';
