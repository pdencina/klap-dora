# Sprint Deploy Center 1.1

## Objetivo

Mejorar claridad, seguridad y experiencia del módulo Deploy Center.

## Mejoras incluidas

1. Estados humanos
- APROBADO_PARA_EJECUCION ahora se muestra como "Aprobado para ejecución".
- El badge principal muestra "Listo para Deploy" o "Pendiente de condiciones".

2. Checklist de condiciones antes de ejecutar
- CAB aprobado
- Plan PAP completo
- Rol Release Manager
- Job Jenkins configurado

3. Bloqueo del botón Jenkins
El botón queda deshabilitado si falta:
- CAB completo
- PAP completo
- Job Jenkins

4. Selector de jobs Jenkins
Nueva API:
- /api/deploy/jobs

Lee Jenkins desde:
- JENKINS_BASE_URL
- JENKINS_USER
- JENKINS_API_TOKEN

Si Jenkins no está configurado, muestra jobs mock/demo.

5. Mejor lectura visual
- "Cambios listos" pasa a "Listos para ejecución".
- Resumen más claro.
- Razón explícita si no se puede ejecutar.

## Archivos modificados/agregados

- app/deploy/page.tsx
- app/api/deploy/jobs/route.ts
- README_DEPLOY_CENTER_1_1.md

## Notas importantes

Para que el botón permita ejecutar, el cambio debe cumplir:
- Tener aprobaciones CAB completas
- Tener Plan PAP con actividades completadas
- Tener estado ejecutable:
  - APROBADO_PARA_EJECUCION
  - PAP_CREADO
  - EN_IMPLEMENTACION

Esto evita ejecutar Jenkins sobre un cambio sin planificación operativa completa.
