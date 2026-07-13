-- ============================================================================
-- Placer Robotics Hub — Slack member disposition tracking
-- Migration: 20260620000055_slack_member_disposition
--
-- The "unexpected" bucket on /admin/slack (an active Slack account matching no
-- known guardian/volunteer/student) surfaces real people every sync: alumni,
-- staff, board members, mentors, volunteers without a Hub profile, and people
-- who should be removed. Before this, resolving that list meant exporting it
-- to a spreadsheet, having an admin mark it up by hand, and someone parsing
-- the markup back in — a full round trip every time the list needed review.
--
-- slack_member_disposition records a standing decision per Slack account
-- (keyed by slack_user_id, which is stable across email changes) so it only
-- needs review ONCE — after that, /admin/slack can separate "already
-- categorized" from "genuinely new" on every future sync.
-- ============================================================================

create table if not exists slack_member_disposition (
  id uuid primary key default gen_random_uuid(),
  slack_user_id text not null unique,
  email text,
  slack_name text,
  tags text[] not null default '{}',
  notes text,
  created_by uuid references admin_profile(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_slack_member_disposition_email on slack_member_disposition(email);

alter table slack_member_disposition enable row level security;

drop policy if exists slack_member_disposition_select on slack_member_disposition;
create policy slack_member_disposition_select on slack_member_disposition for select to authenticated
  using (public.is_admin());

drop policy if exists slack_member_disposition_write on slack_member_disposition;
create policy slack_member_disposition_write on slack_member_disposition for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
