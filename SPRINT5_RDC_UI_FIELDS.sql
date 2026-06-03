alter table rdc add column if not exists presenter text;
alter table rdc add column if not exists technical_lead text;
alter table rdc add column if not exists qa_analyst text;
alter table rdc add column if not exists business_validator text;
alter table rdc add column if not exists jira_origin text;
alter table rdc add column if not exists rfc text;
alter table rdc add column if not exists proposed_deploy_date date;
alter table rdc add column if not exists validation_date date;
alter table rdc add column if not exists deployment_result text default 'PENDIENTE';
