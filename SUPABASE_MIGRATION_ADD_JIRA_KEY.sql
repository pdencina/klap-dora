alter table rdc
add column if not exists jira_key text;

alter table rdc
add column if not exists jira_created_at timestamptz;
