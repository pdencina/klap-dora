-- SPRINT_ECAB_TO_PAP_INJECTION_V1.sql
-- Soporte para inyectar eCAB aprobado al módulo Plan PAP.
-- No crea un Kanban nuevo: reutiliza rdc + pap_steps para mantener flujo único.

alter table if exists public.ecab_requests
add column if not exists rdc_id uuid null references public.rdc(id) on delete set null;

alter table if exists public.rdc_details
add column if not exists form_data jsonb default '{}'::jsonb;

alter table if exists public.rdc_details
add column if not exists form_version text default 'rdc_2_0';

create index if not exists idx_ecab_requests_rdc_id
on public.ecab_requests(rdc_id);

create index if not exists idx_rdc_details_form_data_gin
on public.rdc_details using gin (form_data);

insert into public.app_permissions(key, label, description, section, is_active)
values ('edit_pap', 'Editar PAP', 'Puede crear o modificar actividades del Plan PAP.', 'PAP', true)
on conflict (key) do update set
  label = excluded.label,
  description = excluded.description,
  section = excluded.section,
  is_active = true;

notify pgrst, 'reload schema';
