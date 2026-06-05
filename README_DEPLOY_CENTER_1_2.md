# Sprint Deploy Center 1.2

## Objetivo

Mejorar la experiencia cuando el cambio aún no puede ejecutar Jenkins.

## Mejoras

1. Badge principal más claro
Antes:
- Pendiente de condiciones

Ahora:
- No ejecutable todavía

2. Bloque de bloqueo más accionable
Cuando falta PAP, se muestra:

- Falta completar Plan PAP
- Completa el Plan PAP antes de ejecutar Jenkins
- Botón directo: Ir a Plan PAP

3. Navegación directa a PAP
El botón lleva a:

/pap?rdcId=<id del RDC>

4. PAP intenta abrir directamente el RDC indicado por query param
Si existe en la lista del módulo PAP, queda seleccionado automáticamente.

## Archivos modificados

- app/deploy/page.tsx
- app/pap/page.tsx
- README_DEPLOY_CENTER_1_2.md

## No requiere SQL nuevo
