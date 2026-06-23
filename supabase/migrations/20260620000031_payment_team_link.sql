-- 0031 — Link payments to IQ teams + track check deposit.
-- IQ team fees are recorded as payment_transaction rows; team_id ties them to the
-- team (enrollment_id is for student payments). deposited_at tracks when a paper
-- check actually cleared (separate from received_at).
alter table payment_transaction add column if not exists team_id uuid references team(id);
alter table payment_transaction add column if not exists deposited_at timestamptz;
create index if not exists idx_payment_transaction_team on payment_transaction (team_id);
