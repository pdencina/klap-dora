-- Sprint PAP 1.0 - Plan de Paso a Producción
-- Crea una tabla operativa para reemplazar la planilla manual de pasos a producción.

create table if not exists public.pap_steps (
  id uuid primary key default gen_random_uuid(),
  rdc_id uuid not null references public.rdc(id) on delete cascade,
  step_order int not null default 1,
  activity text not null,
  responsible text,
  planned_time text,
  status text not null default 'Pendiente',
  evidence_url text,
  notes text,
  updated_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_pap_steps_rdc_id
on public.pap_steps (rdc_id);

create index if not exists idx_pap_steps_status
on public.pap_steps (status);

notify pgrst, 'reload schema';
