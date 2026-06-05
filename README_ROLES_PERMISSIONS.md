# Roles y permisos - Klap DORA

## Roles implementados

### 1. Cliente Interno (`client`)
Puede:
- Crear RDC en `/rdc`
- Ver sus cambios en `/mis-cambios`
- Ver estado de sus aprobaciones y PAP

No puede:
- Ver Agenda CAB
- Ver panel Release
- Ver Dashboard DORA
- Generar PAP Jira
- Cerrar cambios

### 2. Release Manager (`rm`)
Puede:
- Ver todo
- Crear y revisar RDC
- Ver `/approvals`, `/cab`, `/release`, `/cierre`, `/dashboard`
- Gestionar CAB, PAP Jira, cierre y DORA

### 3. Aprobador (`approver`)
Puede:
- Ver `/mis-aprobaciones`
- Abrir `/approve/[token]`
- Aprobar / Observar / Rechazar con OTP

No puede:
- Crear RDC
- Ver paneles RM
- Generar PAP
- Cerrar cambios

## Archivos modificados

- lib/auth.ts
- middleware.ts
- app/components/TopNav.tsx
- app/page.tsx
- app/mis-aprobaciones/page.tsx
- app/api/approvals/mine/route.ts
- app/api/rdc/create/route.ts

## SQL

Ejecutar y ajustar correos:

- SPRINT_ROLES_PERMISSIONS.sql

## Recomendación para demo

Crear 3 usuarios:

1. RM:
   - julio.quiroz@klap.cl
   - role: rm

2. Cliente Interno:
   - cliente.interno@klap.cl
   - role: client

3. Aprobador:
   - erika.fica@klap.cl
   - role: approver

Así se puede mostrar:
- Cliente crea RDC
- RM revisa Agenda CAB
- Aprobador decide desde Mis Aprobaciones o desde link OTP
