# RDC Wizard 2.0 listo para subir

Archivos modificados:
- app/rdc/page.tsx
- app/api/rdc/create/route.ts
- app/api/approvals/list/route.ts

Migración:
- SPRINT_RDC_WIZARD_2_FORM_DATA.sql

Qué incluye:
- Wizard de 6 pasos:
  1. General y origen
  2. Descripción del cambio
  3. Clasificación y negocio
  4. Requisitos previos
  5. Ejecución
  6. Despliegue y aprobadores
- Guardado híbrido:
  - Columnas críticas existentes.
  - RDC extendido en rdc_details.form_data jsonb.
- PIM simple multi-fila.
- Sistemas afectados como texto/multivalor simple.
- Mantiene aprobadores y flujo OTP existente.

Antes de probar:
1. Ejecutar SPRINT_RDC_WIZARD_2_FORM_DATA.sql en Supabase.
2. Subir a GitHub.
3. Validar /rdc, /rdc/[id], /approvals y /approve/[token].
