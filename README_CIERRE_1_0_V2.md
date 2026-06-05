# Cierre 1.0 V2 - Archivos reales modificados

Este paquete contiene cambios explícitos para el módulo Cierre.

## Archivos modificados/agregados

- app/cierre/page.tsx
- app/api/cierre/list/route.ts
- app/api/cierre/save/route.ts
- SPRINT_CIERRE_1_0.sql
- README_CIERRE_1_0_V2.md

## Qué deberías ver en /cierre

- Título: Cierre del cambio
- Lista lateral: Para cierre
- Resumen del cambio seleccionado
- Campos:
  - Resultado
  - Ejecución Jenkins asociada
  - Hora real inicio
  - Hora real término
  - ¿Hubo rollback?
  - ¿Hubo incidente?
  - Jira incidente
  - Impacto en servicio
  - Validación QA
  - Validación técnica
  - Validación negocio
  - Observaciones finales
- Botón: Guardar cierre

## SQL requerido

Ejecuta SPRINT_CIERRE_1_0.sql en Supabase antes de probar.

## Validación rápida

Después de subir, busca en tu repo:

- change_closures
- Cierre del cambio
- app/api/cierre/save/route.ts
