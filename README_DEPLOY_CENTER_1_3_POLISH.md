# Deploy Center 1.3 - Visual Polish

## Objetivo

Mejorar la lectura visual del bloque "Condiciones para ejecutar" sin tocar lógica, APIs, Jenkins ni base de datos.

## Cambios

- Badge principal más claro:
  - Si falta PAP: "Pendiente Plan PAP"
  - Si todo está listo: "Listo para Deploy"

- Bloque de bloqueo más ejecutivo:
  - "Plan PAP requerido para ejecución"
  - "Antes de ejecutar Jenkins, completa y valida las actividades del paso a producción."

- Checklist más legible:
  - Mayor espacio entre ícono, título y descripción.
  - Cards con más altura y padding.
  - Warning con ícono ⚠.
  - Texto de Plan PAP más claro.

## Archivos modificados

- app/deploy/page.tsx

## No requiere SQL

Este cambio es solo visual.
