# RDC Lite + PAP 1.0

## Objetivo

Hacer que la creación del RDC sea más liviana y dejar la carga operativa del paso a producción en el módulo Plan PAP.

## Cambios

Archivo modificado:
- app/rdc/page.tsx

El nuevo RDC tiene 4 pasos:

1. General
2. Descripción
3. Responsables
4. Revisión

## Qué queda en RDC

- Identificación del cambio
- Sistema / célula / categoría
- Fecha propuesta
- Jira origen / RFC
- Descripción y solución
- Impacto / prioridad / urgencia
- Responsables
- Aprobadores CAB

## Qué se mueve a Plan PAP

- Actividades detalladas
- Horarios
- Responsables por paso
- Evidencias
- Estados de ejecución
- Checklist operativo
- Detalle fino de rollback y validaciones

## Compatibilidad

El backend no cambia. Se mantienen los campos mínimos necesarios:
- deploymentPlan
- rollbackPlan
- qaPlan
- formData

Estos quedan con texto base indicando que se completan en Plan PAP.
