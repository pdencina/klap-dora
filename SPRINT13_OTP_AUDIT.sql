alter table approval_requests add column if not exists approval_code text;
alter table approval_requests add column if not exists approval_code_sent_at timestamptz;
alter table approval_requests add column if not exists approval_code_expires_at timestamptz;
alter table approval_requests add column if not exists approval_verified_at timestamptz;
alter table approval_requests add column if not exists approved_by_name text;
alter table approval_requests add column if not exists approved_by_email text;
alter table approval_requests add column if not exists approved_ip text;
alter table approval_requests add column if not exists approved_user_agent text;
create index if not exists idx_approval_requests_verified_at on approval_requests(approval_verified_at);
