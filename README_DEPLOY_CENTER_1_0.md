# Sprint Deploy Center 1.0

## Objetivo

Crear un módulo separado para ejecución técnica de pipelines, conectado al RDC/PAP pero sin mezclarlo con el flujo funcional de Change Management.

## Nuevo módulo

Ruta:
- /deploy

Menú:
- Deploy Center

## Archivos agregados/modificados

- app/deploy/page.tsx
- app/api/deploy/list/route.ts
- app/api/deploy/trigger/route.ts
- app/api/deploy/status/route.ts
- app/components/TopNav.tsx
- app/page.tsx
- middleware.ts
- SPRINT_DEPLOY_CENTER_1_0.sql

## Flujo

RDC aprobado
→ Plan PAP
→ Deploy Center
→ Ejecutar Pipeline Jenkins
→ Guardar deployment_runs
→ Cierre
→ DORA

## Antes de probar

Ejecutar en Supabase:

1. SPRINT_PAP_1_0.sql, si no lo ejecutaste antes.
2. SPRINT_DEPLOY_CENTER_1_0.sql

## Variables de entorno para Jenkins real

En Vercel:

JENKINS_BASE_URL=https://jenkins.klap.cl
JENKINS_USER=usuario-servicio
JENKINS_API_TOKEN=token-api

Si estas variables no existen, el sistema registra una ejecución simulada/mock.
Esto permite probar la UI sin romper producción.

## Seguridad

- Solo rol RM puede entrar a /deploy.
- Solo rol RM puede ejecutar /api/deploy/trigger.
- Solo se permite ejecutar cambios en estado:
  - APROBADO_PARA_EJECUCION
  - PAP_CREADO
  - EN_IMPLEMENTACION

## Importante

El botón de Jenkins no vive en el RDC.
Vive en Deploy Center para separar:

- Change Management: solicitud, aprobación y trazabilidad.
- Deploy Center: ejecución técnica y monitoreo.
