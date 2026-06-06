-- Sprint 12 - Fix links de aprobación
-- Asegura que todas las aprobaciones tengan token.

alter table approval_requests
add column if not exists approval_token text unique default gen_random_uuid()::text;

update approval_requests
set approval_token = gen_random_uuid()::text
where approval_token is null;

create index if not exists idx_approval_requests_token on approval_requests(approval_token);
