# Sprint RDC 2.0 - RDC estilo Confluence en RM

Archivos modificados:
- app/api/approvals/list/route.ts
  - Ahora trae rdc_details(*) junto a approval_requests(*)
- app/rdc/[id]/page.tsx
  - Rediseño completo de la ficha maestra RDC

Incluye:
- Resumen ejecutivo
- Descripción del cambio
- Impacto y riesgo CAB
- Sistemas/servicios afectados
- Responsables
- Plan QA y validación
- Plan despliegue producción
- Rollback / mitigación destacado
- Aprobaciones CAB
- Checklist CAB
- Evidencia digital
- Timeline

No toca:
- OTP
- Resend
- Jira PAP
- Agenda CAB
- Flujo de aprobación
