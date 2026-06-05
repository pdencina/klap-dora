# Sprint PAP 1.0 - Plan de Paso a Producción

## Objetivo

Separar el RDC de la planificación operativa del despliegue.

Nuevo flujo:

1. Cliente interno crea RDC
2. RM revisa y activa CAB
3. Aprobadores aprueban
4. RM genera Plan PAP desde el RDC aprobado
5. RM ejecuta/actualiza pasos del deploy
6. Cierre registra resultado real
7. Dashboard DORA se alimenta

## Archivos agregados/modificados

- app/pap/page.tsx
- app/api/pap/list/route.ts
- app/api/pap/steps/route.ts
- app/components/TopNav.tsx
- app/page.tsx
- middleware.ts
- SPRINT_PAP_1_0.sql

## Antes de probar

Ejecutar en Supabase:

SPRINT_PAP_1_0.sql

## Qué permite

- Ver RDC aprobados para ejecución
- Generar pasos del PAP desde el plan de despliegue del RDC
- Editar actividades
- Asignar responsables
- Definir horarios
- Actualizar estado
- Registrar evidencias
- Copiar el plan para Teams/minuta

## No toca

- OTP
- Resend
- Roles
- Aprobaciones
- Jira PAP
- Cierre existente
