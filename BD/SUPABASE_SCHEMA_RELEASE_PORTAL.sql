create table if not exists rdc (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  category text,
  system text,
  cell text,
  status text not null default 'BORRADOR',
  created_by text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists approval_requests (
  id uuid primary key default gen_random_uuid(),
  rdc_id uuid references rdc(id) on delete cascade,
  approver_role text not null,
  approver_name text not null,
  approver_email text,
  approval_token text unique not null default gen_random_uuid()::text,
  status text not null default 'PENDIENTE',
  comment text,
  approved_at timestamptz,
  created_at timestamptz default now()
);

create index if not exists idx_approval_requests_rdc_id on approval_requests(rdc_id);
create index if not exists idx_approval_requests_status on approval_requests(status);
create index if not exists idx_rdc_status on rdc(status);
