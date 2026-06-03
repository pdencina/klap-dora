
alter table approval_requests
add column if not exists approval_code text;

alter table approval_requests
add column if not exists approval_code_sent_at timestamptz;

alter table approval_requests
add column if not exists approval_verified_at timestamptz;
