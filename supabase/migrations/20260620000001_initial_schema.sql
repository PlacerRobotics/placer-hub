-- ============================================================================
-- Placer Robotics Hub — Task 2: Full database schema
-- Migration: 20260620000001_initial_schema
-- Reconciled to PRD docs/product_requirements_v1_13.md Section 10.
--
-- Notes:
--   * All monetary fields are numeric (Zeffy amounts), per PRD.
--   * gen_random_uuid() is built into PostgreSQL 13+ core (Supabase is PG15).
--   * RLS is ENABLED on every table (deny-by-default; policies in later tasks).
--   * Append-only tables (waiver_signature, admin_action_log, sync_log) are
--     enforced with BEFORE UPDATE/DELETE triggers (PRD Section 11).
--   * PRD Section 10 also defines person_role, quiz_question, engagement_event,
--     and engagement_attendance — intentionally OUT OF SCOPE for Task 2's
--     25-table list and not added here.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- ENUM TYPES (per PRD Section 10)
-- ----------------------------------------------------------------------------
create type family_status as enum ('active', 'suspended', 'archived');
create type family_season_status as enum ('prospect', 'applied', 'accepted', 'cleared_to_register', 'registered', 'declined', 'suspended');
create type family_aid_prompt_answer as enum ('yes', 'no');
create type guardian_role as enum ('primary', 'secondary', 'single_guardian', 'extended_family', 'other');
create type slack_invite_status as enum ('not_sent', 'sent', 'accepted', 'failed');
create type student_status as enum ('pending', 'active', 'suspended', 'withdrawn', 'aged_out');
create type tshirt_size as enum ('xs', 's', 'm', 'l', 'xl', 'xxl');
create type program_selection as enum ('vex_v5', 'combat', 'vex_iq', 'not_sure');
create type application_status as enum ('submitted', 'needs_follow_up', 'program_pending', 'accepted', 'declined', 'withdrawn', 'admin_waived');
create type application_source as enum ('platform', 'google_form_sync', 'admin_waived', 'migration');
create type summer_availability as enum ('yes', 'maybe', 'no');
create type financial_aid_status as enum ('pending', 'approved', 'denied', 'withdrawn');
create type financial_aid_resolution as enum ('full_waiver', 'partial_waiver', 'denied');
create type team_program as enum ('vex_v5', 'vex_iq', 'combat');
create type division as enum ('middle', 'high');
create type team_status as enum ('pending', 'pending_payment', 'pending_admin_confirmation', 'active', 'suspended', 'withdrawn');
create type team_fee_status as enum ('not_applicable', 'unpaid', 'paid');
create type registration_fee_status as enum ('unpaid', 'paid', 'waived');
create type fundraising_status as enum ('not_started', 'partial', 'complete', 'waived');
create type waiver_status as enum ('pending', 'complete', 'needs_review');
create type team_role as enum ('student', 'coach', 'manager', 'assistant');
create type team_member_status as enum ('draft', 'confirmed');
create type payment_source as enum ('zeffy', 'check', 'benevity', 'corporate_platform', 'cash', 'manual_adjustment', 'other');
create type payment_type as enum ('registration_fee', 'iq_team_fee', 'fundraising', 'sponsorship', 'in_kind', 'unknown');
create type matched_status as enum ('unmatched', 'auto_matched', 'manually_matched', 'ignored', 'needs_review');
create type volunteer_status as enum ('pending', 'in_progress', 'cleared', 'expired', 'suspended', 'withdrawn');
create type unifi_credential_status as enum ('not_provisioned', 'provisioned', 'revoked');
create type volunteer_step_type as enum ('policy_acknowledgment', 'background_check', 'aps_youth_protection', 'youth_protection_quiz', 'lab_use_quiz', 'lab_orientation', 'custom');
create type step_status as enum ('pending', 'in_progress', 'complete', 'waived');
create type quiz_type as enum ('youth_protection', 'lab_use');
create type waiver_type as enum ('student_participation', 'parent_participation', 'volunteer', 'expectations_agreement', 'youth_protection_summary', 'center_use_summary');
create type sync_type as enum ('google_group', 'slack_user_group', 'slack_channel_invite');
create type sync_action as enum ('add', 'remove', 'invite');
create type admin_role as enum ('super_admin', 'registration_admin', 'financial_aid_admin', 'payment_admin', 'volunteer_admin', 'iq_coordinator', 'program_lead', 'board_member', 'communications_admin', 'student_director', 'read_only_admin');
create type notification_status as enum ('queued', 'sent', 'failed', 'skipped');
create type person_role_type as enum ('steering_committee', 'camp_staff', 'board');
create type question_type as enum ('single_correct', 'multiple_correct');
create type engagement_event_type as enum ('try_it_out', 'info_night', 'rise', 'girl_powered', 'summer_camp', 'outreach', 'open_lab', 'other');

-- ----------------------------------------------------------------------------
-- 10.1 season_config
-- ----------------------------------------------------------------------------
create table season_config (
  id uuid primary key default gen_random_uuid(),
  season text not null unique,
  application_open boolean not null default false,
  registration_open boolean not null default false,
  application_open_at timestamptz,
  application_close_at timestamptz,
  registration_open_at timestamptz,
  registration_close_at timestamptz,
  program_year_start date not null,
  program_year_end date not null,
  fundraising_deadline date not null,
  late_acceptance_grace_days integer not null default 14,
  v5_combat_registration_fee numeric not null default 40,
  iq_student_registration_fee numeric not null default 0,
  iq_team_fee numeric not null default 1200,
  one_program_fundraising_target numeric not null default 550,
  iq_default_fundraising_target numeric not null default 0,
  min_gpa_threshold numeric,
  volunteer_hours_required integer not null default 8,
  zeffy_student_url text,
  zeffy_iq_team_url text,
  zeffy_donation_url text,
  student_waiver_template_id uuid,
  parent_waiver_template_id uuid,
  volunteer_waiver_template_id uuid,
  sync_schedule_minutes integer not null default 15,
  volunteer_renewal_open_at timestamptz,
  volunteer_renewal_target_close_at timestamptz,
  aps_early_warning_days_before integer not null default 90,
  registration_active boolean not null default false,
  sync_active boolean not null default false,
  program_year_active boolean not null default false,
  active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 10.2 school
-- ----------------------------------------------------------------------------
create table school (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  short_name text,
  district text,
  city text,
  active boolean not null default true,
  verified boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 10.3 family (permanent; no season field)
-- ----------------------------------------------------------------------------
create table family (
  id uuid primary key default gen_random_uuid(),
  primary_email text not null unique,
  secondary_email text,
  status family_status not null default 'active',
  display_name text,
  admin_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 10.3a family_season
-- ----------------------------------------------------------------------------
create table family_season (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references family(id) on delete cascade,
  season text not null,
  status family_season_status not null default 'prospect',
  volunteer_hours_required integer not null default 8,
  volunteer_hours_completed integer not null default 0,
  financial_aid_prompt_shown boolean not null default false,
  financial_aid_prompt_answer family_aid_prompt_answer,
  current_season_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (family_id, season)
);

-- ----------------------------------------------------------------------------
-- 10.4 guardian
-- ----------------------------------------------------------------------------
create table guardian (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references family(id) on delete cascade,
  first_name text not null,
  last_name text not null,
  relationship text,
  login_email text not null unique,
  communication_email text,
  slack_email text,
  phone text not null,
  street_address text,
  city text,
  state text,
  zip_code text,
  role guardian_role not null,
  can_authenticate boolean not null default true,
  employer text,
  employer_match_pct numeric,
  occupation text,
  volunteer_interests text[],
  slack_user_id text,
  slack_invite_status slack_invite_status,
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 10.5 student
-- ----------------------------------------------------------------------------
create table student (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references family(id) on delete cascade,
  first_name text not null,
  last_name text not null,
  preferred_name text,
  communication_email text,
  slack_email text,
  fusion_education_email text,
  phone text,
  street_address text,
  city text not null,
  state text,
  zip_code text not null,
  grade integer not null,
  school_id uuid references school(id),
  school_raw text,
  birthdate date,
  under_13_confirmed boolean,
  tshirt_size tshirt_size,
  status student_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 10.4a / 10.5a emergency_contact
-- ----------------------------------------------------------------------------
create table emergency_contact (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references family(id) on delete cascade,
  student_id uuid references student(id) on delete cascade,
  first_name text not null,
  last_name text not null,
  phone text not null,
  relationship text,
  priority integer not null default 1,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 10.6 student_application
-- ----------------------------------------------------------------------------
create table student_application (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references family(id) on delete cascade,
  student_id uuid not null references student(id) on delete cascade,
  season text not null,
  program_interest program_selection not null,
  program_interest_final program_selection,
  status application_status not null default 'submitted',
  gpa_overall numeric,
  gpa_recent_term numeric,
  gpa_flagged boolean not null default false,
  referral_source text,
  previous_experience text[],
  skills_interest text[],
  teammate_preference text,
  motivation_background text,
  motivation_goals text,
  extracurriculars text,
  summer_availability summer_availability,
  triage_notes text,
  source application_source not null default 'platform',
  reviewed_by uuid,
  reviewed_at timestamptz,
  review_notes text,
  waived_by uuid,
  waived_at timestamptz,
  waiver_notes text,
  submitted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (student_id, season)
);

-- ----------------------------------------------------------------------------
-- 10.7 financial_aid (enrollment_id FK deferred — see end of file)
-- ----------------------------------------------------------------------------
create table financial_aid (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references family(id) on delete cascade,
  student_application_id uuid references student_application(id) on delete set null,
  enrollment_id uuid,
  season text not null,
  status financial_aid_status not null default 'pending',
  govt_program_name text,
  need_description text,
  resolution_type financial_aid_resolution,
  original_fundraising_target numeric,
  adjusted_fundraising_target numeric,
  fundraising_waived_amount numeric,
  registration_fee_waiver_requested boolean not null default false,
  registration_fee_waived boolean not null default false,
  registration_fee_waiver_reason text,
  registration_fee_waiver_admin_id uuid,
  registration_fee_waiver_at timestamptz,
  admin_notes text,
  requested_at timestamptz not null default now(),
  resolved_by uuid,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 10.9 enrollment (one per student per program per season; no team_id)
-- ----------------------------------------------------------------------------
create table enrollment (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references family(id) on delete cascade,
  student_id uuid not null references student(id) on delete cascade,
  student_application_id uuid references student_application(id) on delete set null,
  season text not null,
  program program_selection not null,
  division division not null,
  payment_reference_code text not null unique,
  registration_fee_amount numeric not null,
  registration_fee_status registration_fee_status not null default 'unpaid',
  registration_fee_paid_at timestamptz,
  fundraising_target numeric not null,
  fundraising_collected numeric not null default 0,
  fundraising_status fundraising_status not null default 'not_started',
  sponsorship_credit numeric not null default 0,
  financial_aid_id uuid references financial_aid(id) on delete set null,
  waiver_status waiver_status not null default 'pending',
  parent_email_access_certified boolean not null default false,
  student_communication_consent boolean not null default false,
  student_slack_consent boolean not null default false,
  submitted_at timestamptz,
  submission_ip text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (student_id, season, program)
);

-- ----------------------------------------------------------------------------
-- 10.8 team
-- ----------------------------------------------------------------------------
create table team (
  id uuid primary key default gen_random_uuid(),
  season text not null,
  program team_program not null,
  division division not null,
  team_number text,
  team_name text,
  school_org text not null,
  status team_status not null default 'pending',
  team_fee_amount numeric,
  team_fee_status team_fee_status,
  team_payment_reference_code text unique,
  events_vex_com_registered boolean not null default false,
  slack_channel_id text,
  slack_channel_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 10.10 team_member (canonical team assignment)
-- ----------------------------------------------------------------------------
create table team_member (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references team(id) on delete cascade,
  enrollment_id uuid references enrollment(id) on delete cascade,
  guardian_id uuid references guardian(id) on delete cascade,
  student_id uuid references student(id) on delete cascade,
  season text not null,
  team_role team_role not null,
  program program_selection not null,
  status team_member_status not null default 'confirmed',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint team_member_actor_present check (enrollment_id is not null or guardian_id is not null)
);

-- ----------------------------------------------------------------------------
-- 10.12 payment_transaction
-- ----------------------------------------------------------------------------
create table payment_transaction (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references family(id) on delete cascade,
  enrollment_id uuid references enrollment(id) on delete set null,
  team_id uuid references team(id) on delete set null,
  season text not null,
  source payment_source not null,
  source_payment_id text,
  amount numeric not null,
  payment_type payment_type not null,
  donor_name text,
  donor_email text,
  payment_reference_code text,
  received_at timestamptz not null,
  matched_status matched_status not null default 'unmatched',
  matched_by uuid,
  matched_at timestamptz,
  notes text,
  raw_payload jsonb,
  created_by uuid,
  created_at timestamptz not null default now()
);
create unique index payment_transaction_source_unique
  on payment_transaction (source, source_payment_id)
  where source_payment_id is not null;

-- ----------------------------------------------------------------------------
-- 10.13 volunteer_profile
-- ----------------------------------------------------------------------------
create table volunteer_profile (
  id uuid primary key default gen_random_uuid(),
  guardian_id uuid not null unique references guardian(id) on delete cascade,
  family_id uuid not null references family(id) on delete cascade,
  status volunteer_status not null default 'pending',
  applied_at timestamptz,
  cleared_at timestamptz,
  suspended_at timestamptz,
  suspension_reason text,
  aps_user_id text,
  aps_training_url text,
  slack_invited boolean not null default false,
  unifi_credential_id text,
  unifi_credential_status unifi_credential_status,
  unifi_provisioned_at timestamptz,
  unifi_revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 10.14 volunteer_step
-- ----------------------------------------------------------------------------
create table volunteer_step (
  id uuid primary key default gen_random_uuid(),
  volunteer_id uuid not null references volunteer_profile(id) on delete cascade,
  step volunteer_step_type not null,
  status step_status not null default 'pending',
  completed_at timestamptz,
  completed_by uuid,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (volunteer_id, step)
);

-- ----------------------------------------------------------------------------
-- 10.15 youth_protection_cert
-- ----------------------------------------------------------------------------
create table youth_protection_cert (
  id uuid primary key default gen_random_uuid(),
  volunteer_id uuid not null references volunteer_profile(id) on delete cascade,
  aps_cert_id text,
  cert_url text,
  issued_date date not null,
  expiration_date date not null,
  reminder_60_sent boolean not null default false,
  reminder_30_sent boolean not null default false,
  expired_processed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 10.16 quiz
-- ----------------------------------------------------------------------------
create table quiz (
  id uuid primary key default gen_random_uuid(),
  quiz_type quiz_type not null,
  title text not null,
  version text not null,
  pass_threshold numeric not null default 0.90,
  active boolean not null default true,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (quiz_type, version)
);

-- ----------------------------------------------------------------------------
-- 10.18 quiz_attempt
-- ----------------------------------------------------------------------------
create table quiz_attempt (
  id uuid primary key default gen_random_uuid(),
  volunteer_id uuid not null references volunteer_profile(id) on delete cascade,
  quiz_id uuid not null references quiz(id) on delete cascade,
  quiz_version text not null,
  answers jsonb not null,
  score numeric not null,
  passed boolean not null,
  attempted_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 10.19 waiver_template
-- ----------------------------------------------------------------------------
create table waiver_template (
  id uuid primary key default gen_random_uuid(),
  waiver_type waiver_type not null,
  version text not null,
  title text not null,
  body_markdown text not null,
  body_hash text not null,
  effective_date date not null,
  retired_at timestamptz,
  active boolean not null default false,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (waiver_type, version)
);

-- ----------------------------------------------------------------------------
-- 10.20 waiver_signature (append-only)
-- ----------------------------------------------------------------------------
create table waiver_signature (
  id uuid primary key default gen_random_uuid(),
  waiver_template_id uuid not null references waiver_template(id),
  family_id uuid not null references family(id) on delete cascade,
  guardian_id uuid not null references guardian(id) on delete cascade,
  student_id uuid references student(id) on delete cascade,
  enrollment_id uuid references enrollment(id) on delete set null,
  volunteer_id uuid references volunteer_profile(id) on delete set null,
  season text not null,
  waiver_type waiver_type not null,
  waiver_version text not null,
  body_hash text not null,
  typed_name text not null,
  electronic_consent_checked boolean not null,
  read_and_agree_checked boolean not null,
  authenticated_email text not null,
  ip_address text not null,
  user_agent text,
  signed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 10.23 sync_exclusion
-- ----------------------------------------------------------------------------
create table sync_exclusion (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  reason text,
  added_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 10.24 sync_log (append-only)
-- ----------------------------------------------------------------------------
create table sync_log (
  id uuid primary key default gen_random_uuid(),
  sync_type sync_type not null,
  group_email text,
  slack_group text,
  action sync_action not null,
  email text not null,
  resolved_from text,
  success boolean not null,
  error_message text,
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 10.25 admin_profile
-- ----------------------------------------------------------------------------
create table admin_profile (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null unique references auth.users(id) on delete cascade,
  email text not null unique,
  display_name text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 10.26 admin_role_assignment
-- ----------------------------------------------------------------------------
create table admin_role_assignment (
  id uuid primary key default gen_random_uuid(),
  admin_profile_id uuid not null references admin_profile(id) on delete cascade,
  role admin_role not null,
  program_scope program_selection,
  granted_by uuid references admin_profile(id) on delete set null,
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 10.27 notification_log
-- ----------------------------------------------------------------------------
create table notification_log (
  id uuid primary key default gen_random_uuid(),
  family_id uuid references family(id) on delete set null,
  volunteer_id uuid references volunteer_profile(id) on delete set null,
  recipient_email text not null,
  notification_type text not null,
  subject text,
  provider text,
  provider_message_id text,
  status notification_status not null default 'queued',
  error_message text,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 10.28 admin_action_log (append-only)
-- ----------------------------------------------------------------------------
create table admin_action_log (
  id uuid primary key default gen_random_uuid(),
  actor_admin_id uuid references admin_profile(id) on delete set null,
  actor_email text not null,
  action_type text not null,
  target_table text not null,
  target_id uuid not null,
  old_values jsonb,
  new_values jsonb,
  notes text,
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 10.17 quiz_question
-- ----------------------------------------------------------------------------
create table quiz_question (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references quiz(id) on delete cascade,
  question_text text not null,
  question_type question_type not null,
  options jsonb not null,
  correct_answers jsonb not null,
  order_index integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 10.11 person_role
-- ----------------------------------------------------------------------------
create table person_role (
  id uuid primary key default gen_random_uuid(),
  guardian_id uuid not null references guardian(id) on delete cascade,
  role person_role_type not null,
  season text,
  granted_by uuid references admin_profile(id) on delete set null,
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 10.21 engagement_event
-- ----------------------------------------------------------------------------
create table engagement_event (
  id uuid primary key default gen_random_uuid(),
  season text not null,
  event_type engagement_event_type not null,
  event_name text,
  event_date date not null,
  location text,
  notes text,
  created_by uuid references admin_profile(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 10.22 engagement_attendance
-- ----------------------------------------------------------------------------
create table engagement_attendance (
  id uuid primary key default gen_random_uuid(),
  engagement_event_id uuid not null references engagement_event(id) on delete cascade,
  student_application_id uuid references student_application(id) on delete set null,
  name text,
  email text,
  grade integer,
  school_id uuid references school(id) on delete set null,
  school_raw text,
  attended boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- DEFERRED FOREIGN KEYS
--   (a) financial_aid.enrollment_id <-> enrollment (mutual reference)
--   (b) admin_profile actor references from tables created before admin_profile
-- ----------------------------------------------------------------------------
alter table financial_aid add constraint financial_aid_enrollment_fkey
  foreign key (enrollment_id) references enrollment(id) on delete set null;

alter table student_application add constraint student_application_reviewed_by_fkey
  foreign key (reviewed_by) references admin_profile(id) on delete set null;
alter table student_application add constraint student_application_waived_by_fkey
  foreign key (waived_by) references admin_profile(id) on delete set null;
alter table financial_aid add constraint financial_aid_fee_waiver_admin_fkey
  foreign key (registration_fee_waiver_admin_id) references admin_profile(id) on delete set null;
alter table financial_aid add constraint financial_aid_resolved_by_fkey
  foreign key (resolved_by) references admin_profile(id) on delete set null;
alter table payment_transaction add constraint payment_transaction_matched_by_fkey
  foreign key (matched_by) references admin_profile(id) on delete set null;
alter table payment_transaction add constraint payment_transaction_created_by_fkey
  foreign key (created_by) references admin_profile(id) on delete set null;
alter table volunteer_step add constraint volunteer_step_completed_by_fkey
  foreign key (completed_by) references admin_profile(id) on delete set null;
alter table quiz add constraint quiz_created_by_fkey
  foreign key (created_by) references admin_profile(id) on delete set null;
alter table waiver_template add constraint waiver_template_created_by_fkey
  foreign key (created_by) references admin_profile(id) on delete set null;
alter table sync_exclusion add constraint sync_exclusion_added_by_fkey
  foreign key (added_by) references admin_profile(id) on delete set null;

-- ----------------------------------------------------------------------------
-- APPEND-ONLY ENFORCEMENT (PRD Section 11)
-- ----------------------------------------------------------------------------
create or replace function prevent_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'Table %.% is append-only; % is not permitted',
    tg_table_schema, tg_table_name, tg_op;
end;
$$;

create trigger waiver_signature_append_only
  before update or delete on waiver_signature
  for each row execute function prevent_mutation();
create trigger admin_action_log_append_only
  before update or delete on admin_action_log
  for each row execute function prevent_mutation();
create trigger sync_log_append_only
  before update or delete on sync_log
  for each row execute function prevent_mutation();

-- ----------------------------------------------------------------------------
-- ROW LEVEL SECURITY — enabled on ALL tables (deny-by-default; policies later)
-- ----------------------------------------------------------------------------
alter table season_config         enable row level security;
alter table school                enable row level security;
alter table family                enable row level security;
alter table family_season         enable row level security;
alter table guardian              enable row level security;
alter table student               enable row level security;
alter table emergency_contact     enable row level security;
alter table student_application   enable row level security;
alter table financial_aid         enable row level security;
alter table enrollment            enable row level security;
alter table team                  enable row level security;
alter table team_member           enable row level security;
alter table payment_transaction   enable row level security;
alter table volunteer_profile     enable row level security;
alter table volunteer_step        enable row level security;
alter table youth_protection_cert enable row level security;
alter table quiz                  enable row level security;
alter table quiz_attempt          enable row level security;
alter table waiver_template       enable row level security;
alter table waiver_signature      enable row level security;
alter table sync_exclusion        enable row level security;
alter table sync_log              enable row level security;
alter table admin_profile         enable row level security;
alter table admin_role_assignment enable row level security;
alter table notification_log      enable row level security;
alter table admin_action_log      enable row level security;
alter table quiz_question         enable row level security;
alter table person_role           enable row level security;
alter table engagement_event      enable row level security;
alter table engagement_attendance enable row level security;
