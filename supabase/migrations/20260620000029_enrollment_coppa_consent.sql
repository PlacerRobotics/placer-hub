-- 0029 — COPPA parental-consent flag on enrollment. The other per-season consent
-- flags (parent_email_access_certified, student_communication_consent,
-- student_slack_consent) already live on enrollment; this captures the parental
-- consent required at registration when the student is grade 6/7 or under 13.
alter table enrollment add column if not exists coppa_consent_checked boolean not null default false;
