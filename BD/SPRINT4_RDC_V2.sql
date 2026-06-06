create table if not exists rdc_details (
  id uuid primary key default gen_random_uuid(),
  rdc_id uuid not null references rdc(id) on delete cascade,

  requirement_description text,
  implemented_solution text,

  affected_services text,
  affected_users text,
  consequence_not_implementing text,

  validation_plan text,

  deployment_plan text,
  rollback_plan text,

  impact varchar(50),
  priority varchar(50),

  requires_dba boolean default false,
  requires_networks boolean default false,
  requires_infra boolean default false,
  requires_monitoring boolean default false,

  dependent_rdc text,

  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_rdc_details_rdc_id on rdc_details(rdc_id);
