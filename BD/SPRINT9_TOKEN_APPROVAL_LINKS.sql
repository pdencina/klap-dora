alter table approval_requests
add column if not exists approval_token text unique default gen_random_uuid()::text;

alter table approval_requests
add column if not exists approver_account_id text;

create index if not exists idx_approval_requests_token on approval_requests(approval_token);
create index if not exists idx_approval_requests_email on approval_requests(approver_email);
create index if not exists idx_approval_requests_account_id on approval_requests(approver_account_id);
