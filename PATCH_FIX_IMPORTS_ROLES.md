# Fix imports - Roles & Permissions

Corrección aplicada:

Archivo:
- app/api/approvals/mine/route.ts

Antes:
- ../../../../../lib/supabase-admin
- ../../../../../lib/auth

Ahora:
- ../../../../lib/supabase-admin
- ../../../../lib/auth

Motivo:
La ruta app/api/approvals/mine/route.ts está a 4 niveles del root, no a 5.
