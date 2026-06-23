-- 0028 — Store the MinistrySafe/APS external id on the volunteer (user id already
-- lives in volunteer_profile.aps_user_id). Both come from the volunteer roster and
-- are the match keys for the APS training sync.
alter table volunteer_profile add column if not exists aps_external_id text;
