# Sprint Jira PAP Mapping

## Archivos modificados/agregados

- app/api/jira/create-pap/route.ts
- lib/jira-pap-field-map.ts

## Objetivo

Cuando Klap DORA crea el PAP Jira, ahora intenta completar los campos custom identificados desde el XML RSS de Jira.

## Campos mapeados

- Sistema / Producto: customfield_12332
- Categoría de Cambio: customfield_12321
- Calendario de Cambios: customfield_10248
- Consecuencias: customfield_10182
- Descripción del Plan de Despliegue: customfield_10199
- Descripción del Plan de Validación: customfield_10198
- Solución del Requerimiento: customfield_10300
- Razón del Cambio: customfield_10179
- Grado Severidad: customfield_10059
- Adjuntar RDC-DEPLOYMENT: customfield_10318

## Seguridad operacional

Si Jira rechaza alguno de los custom fields por contexto, pantalla o valor inválido, el endpoint reintenta automáticamente creando el PAP con payload base para no bloquear el flujo.

## Variables opcionales

Puedes sobrescribir IDs sin tocar código:

- CF_SISTEMA
- CF_TIPO
- CF_CALENDARIO_CAMBIOS
- CF_CONSECUENCIAS
- CF_PLAN_DESPLIEGUE
- CF_PLAN_VALIDACION
- CF_SOLUCION_REQUERIMIENTO
- CF_RAZON_CAMBIO
- CF_GRADO_SEVERIDAD
- CF_ADJUNTAR_RDC_DEPLOYMENT

Puedes desactivar el mapping extendido con:

- JIRA_ENABLE_PAP_FIELD_MAPPING=false
