-- SPRINT_RDC_TRACEABILITY_1_0.sql
-- Separa el RDC principal de la trazabilidad operacional y evidencias complementarias.
-- Ejecutar en Supabase antes de depender de estas tablas. El código no bloquea la creación del RDC si aún no existen.

create table if not exists public.rdc_traceability (
  id uuid primary key default gen_random_uuid(),
  rdc_id uuid not null references public.rdc(id) on delete cascade,
  type text not null,
  area text null,
  title text not null,
  description text not null,
  created_by text null,
  created_at timestamptz not null default now()
);

create index if not exists idx_rdc_traceability_rdc_id
on public.rdc_traceability (rdc_id);

create index if not exists idx_rdc_traceability_type
on public.rdc_traceability (type);

create table if not exists public.rdc_evidence (
  id uuid primary key default gen_random_uuid(),
  rdc_id uuid not null references public.rdc(id) on delete cascade,
  source text not null default 'MANUAL',
  title text not null,
  url text null,
  file_path text null,
  evidence_type text not null default 'URL',
  created_by text null,
  created_at timestamptz not null default now()
);

create index if not exists idx_rdc_evidence_rdc_id
on public.rdc_evidence (rdc_id);

create index if not exists idx_rdc_evidence_type
on public.rdc_evidence (evidence_type);
