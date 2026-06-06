-- Sprint RDC Wizard 2.0
-- Necesario para guardar el RDC completo extendido sin agregar muchas columnas rígidas.

alter table rdc_details
add column if not exists form_data jsonb default '{}'::jsonb;

alter table rdc_details
add column if not exists form_version text default 'rdc_2_0';

create index if not exists idx_rdc_details_form_data_gin
on rdc_details using gin (form_data);
